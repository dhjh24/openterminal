"""US options chain adapter (FMP primary, yfinance fallback).

Internal IV format
------------------
**Percent** (22.5 = 22.5%). Conversion is driven by **provider schema**, never by
a numeric threshold (the old ``<= 1.5`` heuristic mis-scaled high-IV contracts
such as ``1.51`` → 1.51% instead of 151%).

Provider units (documented)
---------------------------
* **yfinance / Yahoo**: ``impliedVolatility`` is a **decimal fraction**
  (``0.25`` = 25%, ``1.51`` = 151%). Always multiply by 100.
* **FMP** (``/api/v4/option-chain``): ``impliedVolatility`` is a **decimal
  fraction** per FMP's option-chain schema. Always multiply by 100.
* **unknown**: reject — return ``None`` so the caller marks the leg invalid.

Greeks are always locally calculated (Black-Scholes via mibian) and must be
labeled ``greeks_source: "calculated"`` — never presented as provider-supplied.
"""

from __future__ import annotations

import asyncio
import logging
import math
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

import httpx
import yfinance as yf
from backend.config.settings import get_settings
from backend.fno.services.greeks_engine import year_fraction_to_expiry
from backend.shared.market_profile import get_us_risk_free_rate_pct

logger = logging.getLogger(__name__)

ET = ZoneInfo("America/New_York")

# Providers whose documented IV unit is a decimal fraction (0.25 = 25%).
_DECIMAL_IV_PROVIDERS = frozenset({"yfinance", "yahoo", "fmp"})


def normalize_iv_percent(
    raw_iv: Any,
    *,
    provider: str,
) -> float | None:
    """Normalize provider IV to internal percent (22.5 = 22.5%).

    Conversion follows the provider schema (see module docstring), not a
    numeric threshold. Returns ``None`` for null, negative, NaN, infinity, or
    an unknown provider unit.
    """
    if raw_iv is None:
        return None
    try:
        iv = float(raw_iv)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(iv) or iv < 0:
        return None
    if iv == 0:
        return 0.0

    prov = (provider or "").strip().lower()
    if prov in _DECIMAL_IV_PROVIDERS:
        return iv * 100.0
    # Unknown unit — do not guess.
    logger.warning("event=iv_unknown_provider provider=%s raw=%s", provider, raw_iv)
    return None


def _actual_days_to_expiry(expiry: str, *, now: datetime | None = None) -> int:
    try:
        today = (now or datetime.now(ET)).astimezone(ET).date()
        return (datetime.strptime(expiry, "%Y-%m-%d").date() - today).days
    except Exception:
        return 0


def _leg_data_quality(
    *,
    bid: float,
    ask: float,
    ltp: float,
    iv: float,
    volume: int,
    oi: int,
) -> str:
    """Per-leg quality: ok | partial | stale | empty."""
    if ltp <= 0 and bid <= 0 and ask <= 0 and iv <= 0:
        return "empty"
    flags: list[str] = []
    if bid <= 0 or ask <= 0:
        flags.append("missing_quote")
    elif bid > ask:
        flags.append("crossed_market")
    if ltp <= 0:
        flags.append("no_last")
    if iv <= 0:
        flags.append("no_iv")
    if volume == 0:
        flags.append("zero_volume")
    if oi == 0:
        flags.append("zero_oi")
    if not flags:
        return "ok"
    if ltp > 0 and iv > 0:
        return "partial"
    return "stale"


def _chain_data_quality(strikes: List[Dict[str, Any]]) -> str:
    if not strikes:
        return "empty"
    leg_qualities: list[str] = []
    for row in strikes:
        for key in ("ce", "pe"):
            leg = row.get(key)
            if isinstance(leg, dict):
                leg_qualities.append(str(leg.get("data_quality") or "empty"))
    if not leg_qualities:
        return "empty"
    if all(q == "empty" for q in leg_qualities):
        return "empty"
    if all(q == "ok" for q in leg_qualities):
        return "ok"
    if any(q in {"ok", "partial"} for q in leg_qualities):
        return "partial"
    return "stale"


class USOptionsAdapter:
    """Fetches and normalizes US option chain data using FMP or yfinance."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.fmp_key = self.settings.fmp_api_key
        self.risk_free_rate = get_us_risk_free_rate_pct()

    def _get_greeks_engine(self):
        from backend.fno.services.greeks_engine import get_greeks_engine

        return get_greeks_engine()

    def _to_float(self, value: Any, default: float = 0.0) -> float:
        try:
            out = float(value)
            return default if out != out else out
        except (TypeError, ValueError):
            return default

    def _to_int(self, value: Any, default: int = 0) -> int:
        return int(self._to_float(value, float(default)))

    def _occ_symbol(self, opt: Dict[str, Any]) -> str:
        for key in ("contractSymbol", "contract_symbol", "occ_symbol", "symbol"):
            val = opt.get(key)
            if val and str(val).strip():
                return str(val).strip().upper()
        return ""

    async def get_expiry_dates(self, symbol: str) -> List[str]:
        """Fetch available expiry dates for a US stock."""
        try:
            ticker = yf.Ticker(symbol)
            expiries = await asyncio.to_thread(lambda: ticker.options)
            return list(expiries)
        except Exception as e:
            logger.error("Error fetching US expiries for %s: %s", symbol, e)
            return []

    async def get_option_chain(
        self, symbol: str, expiry: str, strike_range: int = 20
    ) -> Dict[str, Any]:
        """Fetch option chain for a specific symbol and expiry."""
        symbol = symbol.upper()
        source = "unavailable"
        delay_status = "unavailable"

        spot = 0.0
        try:
            ticker = yf.Ticker(symbol)
            info = await asyncio.to_thread(lambda: ticker.info)
            spot = (
                info.get("regularMarketPrice")
                or info.get("currentPrice")
                or info.get("previousClose")
                or 0.0
            )
        except Exception as e:
            logger.error("Error fetching spot for %s: %s", symbol, e)

        chain_data: List[Dict[str, Any]] | None = None
        if self.fmp_key:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    url = f"https://financialmodelingprep.com/api/v4/option-chain/{symbol}"
                    resp = await client.get(url, params={"apikey": self.fmp_key})
                    if resp.status_code == 200:
                        raw_data = resp.json()
                        if isinstance(raw_data, list):
                            chain_data = [
                                opt for opt in raw_data if opt.get("expiration") == expiry
                            ]
                            if chain_data:
                                source = "fmp"
                                delay_status = "delayed"
            except Exception as e:
                logger.error("FMP US Options error for %s: %s", symbol, e)

        if not chain_data:
            try:
                ticker = yf.Ticker(symbol)
                opt_chain = await asyncio.to_thread(lambda: ticker.option_chain(expiry))
                chain_data = self._from_yf_chain(opt_chain)
                if chain_data:
                    source = "yfinance"
                    delay_status = "delayed"
            except Exception as e:
                logger.error("yfinance US Options error for %s: %s", symbol, e)
                return self._empty_chain(symbol, expiry, source="yfinance", delay_status="unavailable")

        if not chain_data:
            return self._empty_chain(symbol, expiry, source=source, delay_status=delay_status)

        return self._normalize_chain(
            symbol,
            spot,
            expiry,
            chain_data,
            strike_range,
            source=source,
            delay_status=delay_status,
        )

    def _from_yf_chain(self, yf_chain: Any) -> List[Dict[str, Any]]:
        """Convert yfinance option chain object to a list of dicts."""
        combined: list[dict[str, Any]] = []
        try:
            for _, row in yf_chain.calls.iterrows():
                d = row.to_dict()
                d["type"] = "C"
                combined.append(d)
            for _, row in yf_chain.puts.iterrows():
                d = row.to_dict()
                d["type"] = "P"
                combined.append(d)
        except Exception:
            return []
        return combined

    def _normalize_chain(
        self,
        symbol: str,
        spot: float,
        expiry: str,
        data: List[Dict[str, Any]],
        strike_range: int,
        *,
        source: str = "calculated",
        delay_status: str = "delayed",
    ) -> Dict[str, Any]:
        grouped: dict[float, dict[str, Any]] = {}
        now_et = datetime.now(ET)
        actual_dte = _actual_days_to_expiry(expiry, now=now_et)
        year_frac = year_fraction_to_expiry(now=now_et, expiry=expiry)
        greeks_engine = self._get_greeks_engine()
        rfr = self.risk_free_rate
        # Map adapter source labels to IV provider schema keys.
        iv_provider = "fmp" if source == "fmp" else "yfinance"

        for opt in data:
            if not isinstance(opt, dict):
                continue
            strike = self._to_float(opt.get("strike"))
            if strike <= 0:
                continue
            if strike not in grouped:
                grouped[strike] = {
                    "strike_price": strike,
                    "ce": self._empty_leg(),
                    "pe": self._empty_leg(),
                }

            opt_type = str(opt.get("type", opt.get("optionType", ""))).upper()
            if "CALL" in opt_type or opt_type in {"C", "CE"}:
                key = "ce"
                mibian_type = "CE"
            else:
                key = "pe"
                mibian_type = "PE"

            iv_norm = normalize_iv_percent(
                opt.get("impliedVolatility", opt.get("iv")),
                provider=iv_provider,
            )
            iv_invalid = iv_norm is None and opt.get("impliedVolatility", opt.get("iv")) is not None
            iv = float(iv_norm) if iv_norm is not None else 0.0
            ltp = self._to_float(opt.get("lastPrice", opt.get("price", 0.0)))
            bid = self._to_float(opt.get("bid"))
            ask = self._to_float(opt.get("ask"))
            volume = self._to_int(opt.get("volume"))
            oi = self._to_int(opt.get("openInterest"))

            if iv <= 0 and not iv_invalid and ltp > 0 and spot > 0:
                iv = greeks_engine.compute_iv(
                    spot,
                    strike,
                    actual_dte,
                    ltp,
                    mibian_type,
                    risk_free_rate_pct=rfr,
                    year_fraction=year_frac,
                )

            greeks = (
                greeks_engine.compute_greeks(
                    spot,
                    strike,
                    actual_dte,
                    iv,
                    mibian_type,
                    risk_free_rate_pct=rfr,
                    year_fraction=year_frac,
                )
                if spot > 0 and (iv > 0 or ltp > 0)
                else {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}
            )

            occ = self._occ_symbol(opt)
            leg_quality = _leg_data_quality(
                bid=bid, ask=ask, ltp=ltp, iv=iv, volume=volume, oi=oi
            )
            if iv_invalid:
                leg_quality = "stale"

            leg = {
                "oi": oi,
                "oi_change": 0,
                "volume": volume,
                "iv": round(iv, 4),
                "iv_unit": "percent",
                "iv_valid": not iv_invalid,
                "ltp": ltp,
                "bid": bid,
                "ask": ask,
                "price_change": self._to_float(opt.get("change")),
                "greeks": greeks,
                "greeks_source": "calculated",
                "data_quality": leg_quality,
                "days_to_expiry": actual_dte,
                "year_fraction": year_frac,
            }
            if occ:
                leg["contract_symbol"] = occ
                leg["occ_symbol"] = occ

            grouped[strike][key] = leg

        strikes = sorted(grouped.values(), key=lambda x: x["strike_price"])

        if strikes and strike_range > 0 and spot > 0:
            idx = min(
                range(len(strikes)),
                key=lambda i: abs(strikes[i]["strike_price"] - spot),
            )
            left = max(0, idx - strike_range)
            right = min(len(strikes), idx + strike_range + 1)
            strikes = strikes[left:right]

        data_quality = _chain_data_quality(strikes)
        ts = datetime.now(timezone.utc).isoformat()

        return {
            "symbol": symbol,
            "market": "US",
            "spot_price": spot,
            "timestamp": ts,
            "expiry_date": expiry,
            "days_to_expiry": actual_dte,
            "year_fraction": year_frac,
            "available_expiries": [],
            "atm_strike": self._find_atm(spot, strikes),
            "strikes": strikes,
            "totals": self._calculate_totals(strikes),
            "source": source,
            "delay_status": delay_status,
            "data_quality": data_quality,
            "greeks_source": "calculated",
            "risk_free_rate_pct": rfr,
        }

    def _find_atm(self, spot: float, strikes: List[Dict[str, Any]]) -> float:
        if not strikes or spot <= 0:
            return 0.0
        return min([s["strike_price"] for s in strikes], key=lambda x: abs(x - spot))

    def _calculate_totals(self, strikes: List[Dict[str, Any]]) -> Dict[str, Any]:
        ce_oi = sum(s["ce"]["oi"] for s in strikes)
        pe_oi = sum(s["pe"]["oi"] for s in strikes)
        ce_vol = sum(s["ce"]["volume"] for s in strikes)
        pe_vol = sum(s["pe"]["volume"] for s in strikes)
        return {
            "ce_oi_total": ce_oi,
            "pe_oi_total": pe_oi,
            "ce_volume_total": ce_vol,
            "pe_volume_total": pe_vol,
            "pcr_oi": round(pe_oi / ce_oi, 4) if ce_oi > 0 else 0.0,
            "pcr_volume": round(pe_vol / ce_vol, 4) if ce_vol > 0 else 0.0,
        }

    def _empty_leg(self) -> Dict[str, Any]:
        return {
            "oi": 0,
            "oi_change": 0,
            "volume": 0,
            "iv": 0.0,
            "ltp": 0.0,
            "bid": 0.0,
            "ask": 0.0,
            "price_change": 0.0,
            "greeks": {"delta": 0, "gamma": 0, "theta": 0, "vega": 0, "rho": 0},
            "greeks_source": "calculated",
            "data_quality": "empty",
        }

    def _empty_chain(
        self,
        symbol: str,
        expiry: str,
        *,
        source: str = "unavailable",
        delay_status: str = "unavailable",
    ) -> Dict[str, Any]:
        return {
            "symbol": symbol,
            "market": "US",
            "spot_price": 0.0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "expiry_date": expiry,
            "days_to_expiry": _actual_days_to_expiry(expiry),
            "available_expiries": [],
            "atm_strike": 0.0,
            "strikes": [],
            "totals": {
                "ce_oi_total": 0,
                "pe_oi_total": 0,
                "ce_volume_total": 0,
                "pe_volume_total": 0,
                "pcr_oi": 0.0,
                "pcr_volume": 0.0,
            },
            "source": source,
            "delay_status": delay_status,
            "data_quality": "empty",
            "greeks_source": "calculated",
            "risk_free_rate_pct": self.risk_free_rate,
        }
