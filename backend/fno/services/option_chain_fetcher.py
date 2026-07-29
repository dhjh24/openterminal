from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from backend.core.ttl_policy import market_open_now
from backend.fno.services.greeks_engine import get_greeks_engine
from backend.shared.cache import cache as default_cache
from backend.shared.market_profile import (
    get_us_risk_free_rate_pct,
    is_india_exchange,
    is_us_only,
    unsupported_market_detail,
)

INDEX_SYMBOLS = {"NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50"}
US_INDEX_SYMBOLS = {"SPX", "VIX", "^SPX", "^VIX", "SPXW", "VIXW"}
US_OPTION_EXCHANGES = {"NASDAQ", "NYSE", "AMEX", "CBOE", "CME"}


class OptionChainFetcher:
    """Fetches and normalizes US option chain data."""

    def __init__(self, cache: Any = None) -> None:
        self._cache = cache or default_cache
        self._greeks = get_greeks_engine()
        self._risk_free_rate_pct = get_us_risk_free_rate_pct()

    def _get_us_adapter(self):
        from backend.adapters.us_options_adapter import USOptionsAdapter
        return USOptionsAdapter()

    def _get_market_classifier(self):
        from backend.shared.market_classifier import market_classifier
        return market_classifier

    def _to_float(self, value: Any, default: float = 0.0) -> float:
        try:
            out = float(value)
            if out != out:
                return default
            return out
        except (TypeError, ValueError):
            return default

    def _as_iso_date(self, value: Any) -> str:
        text = str(value or "").strip()
        if not text:
            return ""
        try:
            return datetime.strptime(text, "%d-%b-%Y").date().isoformat()
        except Exception:
            pass
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).date().isoformat()
        except Exception:
            return text

    def _pick_expiry(self, available: list[str], expiry: str | None) -> str:
        if not available:
            return expiry or ""
        if expiry and expiry in available:
            return expiry
        today = date.today()
        future_sorted = sorted(available)
        for val in future_sorted:
            try:
                if date.fromisoformat(val) >= today:
                    return val
            except Exception:
                continue
        return future_sorted[0]

    def _is_us_symbol(self, symbol: str, cls: Any) -> bool:
        sym = (symbol or "").strip().upper()
        if sym in US_INDEX_SYMBOLS:
            return True
        if getattr(cls, "country_code", "") == "US":
            return True
        exchange = str(getattr(cls, "exchange", "") or "").strip().upper()
        if exchange in US_OPTION_EXCHANGES:
            return True
        if sym and "." not in sym and not sym.endswith((".NS", ".BO")):
            if sym not in INDEX_SYMBOLS:
                return True
        return False

    def _india_unsupported_response(self, symbol: str) -> dict[str, Any]:
        ts = datetime.now(timezone.utc).isoformat()
        detail = unsupported_market_detail("NSE")
        return {
            "symbol": symbol,
            "market": "US",
            "spot_price": 0.0,
            "timestamp": ts,
            "expiry_date": "",
            "days_to_expiry": 0,
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
            "source": "unavailable",
            "delay_status": "unavailable",
            "data_quality": "empty",
            "greeks_source": "calculated",
            "risk_free_rate_pct": self._risk_free_rate_pct,
            "error": detail["error"],
            "message": detail["message"],
        }

    def _empty_chain(self, symbol: str) -> dict[str, Any]:
        ts = datetime.now(timezone.utc).isoformat()
        return {
            "symbol": symbol,
            "spot_price": 0.0,
            "timestamp": ts,
            "expiry_date": "",
            "days_to_expiry": 0,
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
            "source": "unavailable",
            "delay_status": "unavailable",
            "data_quality": "empty",
            "greeks_source": "calculated",
            "risk_free_rate_pct": self._risk_free_rate_pct,
        }

    async def get_option_chain(self, symbol: str, expiry: str | None = None, strike_range: int = 20) -> dict[str, Any]:
        symbol_u = (symbol or "").strip().upper()
        if not symbol_u:
            return self._empty_chain("")

        market_classifier = self._get_market_classifier()
        cls = await market_classifier.classify(symbol_u)

        if is_us_only():
            if symbol_u in INDEX_SYMBOLS or is_india_exchange(cls.exchange):
                return self._india_unsupported_response(symbol_u)
            is_us = True
        else:
            is_us = self._is_us_symbol(symbol_u, cls)

        if not is_us:
            return self._india_unsupported_response(symbol_u)

        cache_key = self._cache.build_key("fno_option_chain", symbol_u, {"expiry": expiry or "", "range": int(strike_range)})
        cached = await self._cache.get(cache_key)
        if cached:
            return cached

        us_adapter = self._get_us_adapter()
        if not expiry:
            expiries = await us_adapter.get_expiry_dates(symbol_u)
            expiry = self._pick_expiry(expiries, None)

        chain = await us_adapter.get_option_chain(symbol_u, expiry, strike_range)
        if not chain.get("available_expiries"):
            chain["available_expiries"] = await us_adapter.get_expiry_dates(symbol_u)
        chain["market"] = "US"
        chain.setdefault("greeks_source", "calculated")
        chain.setdefault("risk_free_rate_pct", self._risk_free_rate_pct)

        try:
            from backend.fno.services.iv_engine import get_iv_engine
            iv_engine = get_iv_engine()
            atm_iv = iv_engine._atm_iv(chain)
            iv_percentile, iv_rank = await iv_engine._iv_rank_percentile(symbol_u, atm_iv)
            chain["iv_rank"] = iv_rank
            chain["iv_percentile"] = iv_percentile
            chain["atm_iv"] = atm_iv
        except Exception:
            chain["iv_rank"] = 0.0
            chain["iv_percentile"] = 0.0
            chain["atm_iv"] = 0.0

        ttl = 60 if market_open_now() else 120
        await self._cache.set(cache_key, chain, ttl=ttl)
        return chain

    async def get_expiry_dates(self, symbol: str) -> list[str]:
        symbol_u = symbol.strip().upper()
        if is_us_only() and symbol_u in INDEX_SYMBOLS:
            return []
        market_classifier = self._get_market_classifier()
        cls = await market_classifier.classify(symbol_u)
        if is_us_only() or self._is_us_symbol(symbol_u, cls):
            return await self._get_us_adapter().get_expiry_dates(symbol_u)
        return []


_option_chain_fetcher = OptionChainFetcher()


def get_option_chain_fetcher() -> OptionChainFetcher:
    return _option_chain_fetcher
