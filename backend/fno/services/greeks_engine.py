"""Black-Scholes Greeks engine for U.S. equity options.

Internal units
--------------
* **IV**: percent (22.5 = 22.5%)
* **risk-free rate**: percent (4.5 = 4.5%) — configurable via ``US_RISK_FREE_RATE``
  (fallback :data:`~backend.shared.market_profile.DEFAULT_US_RISK_FREE_RATE_PCT`,
  not a live Treasury quote)
* **time**: year fraction ``T`` passed to the pricing formula; mibian accepts
  calendar days, so we convert ``T * 365`` (fractional days supported for 0DTE)

0DTE / fractional time
----------------------
When calendar DTE is 0, time-to-expiry is the fraction of the year remaining
until the contract's expiration timestamp (exact, or derived from the NYSE
session close on the expiry date in ``America/New_York``). At or after
expiration, Greeks are settled to intrinsic limits without NaN / division-by-zero.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from backend.shared.market_calendar import session_close_at
from backend.shared.market_profile import get_us_risk_free_rate_pct

ET = ZoneInfo("America/New_York")
_SECONDS_PER_YEAR = 365.0 * 24.0 * 3600.0
_MIN_YEAR_FRACTION = 1.0 / (365.0 * 24.0 * 60.0)  # one minute of year fraction


def year_fraction_to_expiry(
    *,
    now: datetime | None = None,
    expiry: date | datetime | str | None = None,
    expiry_ts: datetime | None = None,
    exchange: str = "NYSE",
) -> float:
    """Return year fraction ``T`` from ``now`` to option expiration.

    Prefer ``expiry_ts`` when known. Otherwise derive the equity-session close
    on the expiry calendar date (honors early closes / holidays via the
    exchange calendar). Uses timezone-aware ``America/New_York`` timestamps.

    Returns 0.0 at or after expiration.
    """
    now_et = now or datetime.now(ET)
    if now_et.tzinfo is None:
        now_et = now_et.replace(tzinfo=ET)
    else:
        now_et = now_et.astimezone(ET)

    end: datetime | None = None
    if expiry_ts is not None:
        end = expiry_ts if expiry_ts.tzinfo else expiry_ts.replace(tzinfo=ET)
        end = end.astimezone(ET)
    elif expiry is not None:
        if isinstance(expiry, datetime):
            end = expiry if expiry.tzinfo else expiry.replace(tzinfo=ET)
            end = end.astimezone(ET)
        else:
            if isinstance(expiry, str):
                try:
                    exp_date = date.fromisoformat(expiry[:10])
                except ValueError:
                    return 0.0
            else:
                exp_date = expiry
            end = session_close_at(exchange, exp_date)
            if end is None:
                # Holiday / weekend — use 16:00 ET as a conservative close.
                end = datetime(
                    exp_date.year, exp_date.month, exp_date.day, 16, 0, tzinfo=ET
                )

    if end is None:
        return 0.0

    seconds = (end - now_et).total_seconds()
    if seconds <= 0:
        return 0.0
    return seconds / _SECONDS_PER_YEAR


def bs_days_from_year_fraction(t: float) -> float:
    """Convert year fraction to mibian day count (fractional days allowed)."""
    if t <= 0 or not math.isfinite(t):
        return 0.0
    return t * 365.0


def bs_days(days_to_expiry: float | int) -> float:
    """Legacy helper: calendar days for BS math.

    Prefer :func:`year_fraction_to_expiry` + :meth:`GreeksEngine.compute_greeks`
    with ``year_fraction=``. Zero / negative calendar days no longer floor to 1;
    callers should pass a fractional year (or fractional days) for 0DTE.
    """
    try:
        d = float(days_to_expiry)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(d) or d <= 0:
        return 0.0
    return d


def _settled_greeks(spot: float, strike: float, option_type: str) -> dict[str, float]:
    """Intrinsic-limit Greeks at/after expiration (no NaN)."""
    opt = (option_type or "CE").strip().upper()
    is_call = opt not in {"PE", "P", "PUT"}
    if is_call:
        delta = 1.0 if spot > strike else (0.5 if spot == strike else 0.0)
    else:
        delta = -1.0 if spot < strike else (-0.5 if spot == strike else 0.0)
    return {
        "delta": round(delta, 6),
        "gamma": 0.0,
        "theta": 0.0,
        "vega": 0.0,
        "rho": 0.0,
    }


class GreeksEngine:
    """Computes option Greeks using Black-Scholes (mibian).

    ``risk_free_rate_pct`` is expressed as percent (4.5 = 4.5%), matching mibian.
    Internal IV is also percent (22.5 = 22.5%).
    """

    def __init__(self, risk_free_rate_pct: float | None = None) -> None:
        self._default_rfr_pct = (
            risk_free_rate_pct
            if risk_free_rate_pct is not None
            else get_us_risk_free_rate_pct()
        )

    def _resolve_rfr(self, risk_free_rate_pct: float | None) -> float:
        if risk_free_rate_pct is not None:
            return risk_free_rate_pct
        return self._default_rfr_pct

    def _to_float(self, value: Any, default: float = 0.0) -> float:
        try:
            out = float(value)
            if out != out or math.isinf(out):
                return default
            return out
        except (TypeError, ValueError):
            return default

    def compute_greeks(
        self,
        spot: float,
        strike: float,
        days_to_expiry: float | int = 0,
        iv: float = 0.0,
        option_type: str = "CE",
        *,
        risk_free_rate_pct: float | None = None,
        year_fraction: float | None = None,
        now: datetime | None = None,
        expiry: date | datetime | str | None = None,
        expiry_ts: datetime | None = None,
    ) -> dict[str, float]:
        """
        Compute Greeks for a single option.

        Prefer ``year_fraction`` (or ``expiry`` / ``expiry_ts``) for accurate
        0DTE pricing. ``days_to_expiry`` remains supported for multi-day DTE;
        when it is 0 and no year fraction is supplied, time is derived from
        ``expiry`` if present, otherwise treated as expired.

        ``iv`` is percent (22.5 = 22.5%).

        Returns: {"delta", "gamma", "theta", "vega", "rho"}
        """
        spot_f = max(self._to_float(spot), 0.01)
        strike_f = max(self._to_float(strike), 0.01)
        iv_f = max(self._to_float(iv), 0.01)
        rfr = self._resolve_rfr(risk_free_rate_pct)

        if year_fraction is not None:
            t = self._to_float(year_fraction, 0.0)
        elif expiry is not None or expiry_ts is not None:
            t = year_fraction_to_expiry(
                now=now, expiry=expiry, expiry_ts=expiry_ts
            )
        else:
            dte = self._to_float(days_to_expiry, 0.0)
            if dte > 0:
                t = dte / 365.0
            else:
                t = 0.0

        if t <= 0 or not math.isfinite(t):
            return _settled_greeks(spot_f, strike_f, option_type)

        # Floor extremely small T (sub-minute) to avoid numerical blow-ups while
        # still reflecting near-expiry behavior.
        t_eff = max(t, _MIN_YEAR_FRACTION)
        dte_bs = bs_days_from_year_fraction(t_eff)

        try:
            import mibian  # type: ignore

            bs = mibian.BS([spot_f, strike_f, rfr, dte_bs], volatility=iv_f)
            opt = (option_type or "CE").strip().upper()
            if opt in {"PE", "P", "PUT"}:
                delta = self._to_float(getattr(bs, "putDelta", 0.0))
                theta = self._to_float(getattr(bs, "putTheta", 0.0))
                rho = self._to_float(getattr(bs, "putRho", 0.0))
            else:
                delta = self._to_float(getattr(bs, "callDelta", 0.0))
                theta = self._to_float(getattr(bs, "callTheta", 0.0))
                rho = self._to_float(getattr(bs, "callRho", 0.0))
            gamma = self._to_float(getattr(bs, "gamma", 0.0))
            vega = self._to_float(getattr(bs, "vega", 0.0))
            out = {
                "delta": round(delta, 6),
                "gamma": round(gamma, 6),
                "theta": round(theta, 6),
                "vega": round(vega, 6),
                "rho": round(rho, 6),
            }
            # Guard against provider/library NaN leakage
            for k, v in list(out.items()):
                if not math.isfinite(v):
                    return _settled_greeks(spot_f, strike_f, option_type)
            return out
        except Exception:
            return {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}

    def compute_iv(
        self,
        spot: float,
        strike: float,
        days_to_expiry: float | int,
        option_price: float,
        option_type: str = "CE",
        *,
        risk_free_rate_pct: float | None = None,
        year_fraction: float | None = None,
    ) -> float:
        """Compute implied volatility (percent) from option price using bisection."""
        target = max(self._to_float(option_price), 0.0)
        if target <= 0:
            return 0.0

        rfr = self._resolve_rfr(risk_free_rate_pct)
        if year_fraction is not None:
            t = self._to_float(year_fraction, 0.0)
        else:
            dte = self._to_float(days_to_expiry, 0.0)
            t = dte / 365.0 if dte > 0 else 0.0
        if t <= 0:
            return 0.0
        dte_bs = bs_days_from_year_fraction(max(t, _MIN_YEAR_FRACTION))
        spot_f = max(self._to_float(spot), 0.01)
        strike_f = max(self._to_float(strike), 0.01)

        def _price(vol: float) -> float:
            try:
                import mibian  # type: ignore

                bs = mibian.BS(
                    [spot_f, strike_f, rfr, dte_bs],
                    volatility=max(vol, 0.01),
                )
                if (option_type or "CE").strip().upper() in {"PE", "P", "PUT"}:
                    return self._to_float(getattr(bs, "putPrice", 0.0))
                return self._to_float(getattr(bs, "callPrice", 0.0))
            except Exception:
                return 0.0

        lo = 0.01
        hi = 300.0
        for _ in range(40):
            mid = (lo + hi) / 2.0
            p = _price(mid)
            if abs(p - target) < 1e-4:
                return round(mid, 4)
            if p > target:
                hi = mid
            else:
                lo = mid
        return round((lo + hi) / 2.0, 4)

    def compute_chain_greeks(
        self,
        chain_data: dict[str, Any],
        *,
        risk_free_rate_pct: float | None = None,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        """Add calculated Greeks to every strike in an option chain."""
        spot = self._to_float(chain_data.get("spot_price"), 0.0)
        rfr = self._resolve_rfr(
            risk_free_rate_pct
            if risk_free_rate_pct is not None
            else chain_data.get("risk_free_rate_pct")
        )

        expiry = str(chain_data.get("expiry_date") or "")
        expiry_ts_raw = chain_data.get("expiry_ts")
        expiry_ts: datetime | None = None
        if isinstance(expiry_ts_raw, datetime):
            expiry_ts = expiry_ts_raw
        elif isinstance(expiry_ts_raw, str) and expiry_ts_raw:
            try:
                expiry_ts = datetime.fromisoformat(expiry_ts_raw.replace("Z", "+00:00"))
            except ValueError:
                expiry_ts = None

        quote_ts_raw = chain_data.get("timestamp") or chain_data.get("quote_ts")
        quote_now = now
        if quote_now is None and isinstance(quote_ts_raw, str) and quote_ts_raw:
            try:
                quote_now = datetime.fromisoformat(quote_ts_raw.replace("Z", "+00:00"))
            except ValueError:
                quote_now = None
        if quote_now is None:
            quote_now = datetime.now(timezone.utc)

        t = year_fraction_to_expiry(
            now=quote_now, expiry=expiry or None, expiry_ts=expiry_ts
        )
        # Keep integer calendar DTE for display; pricing uses year fraction.
        actual_dte = chain_data.get("days_to_expiry")
        if actual_dte is None:
            actual_dte = 0
            if expiry:
                try:
                    actual_dte = (date.fromisoformat(expiry[:10]) - quote_now.astimezone(ET).date()).days
                except Exception:
                    actual_dte = 0
        actual_dte = int(actual_dte)

        strikes = chain_data.get("strikes")
        if not isinstance(strikes, list):
            return chain_data

        for row in strikes:
            if not isinstance(row, dict):
                continue
            strike = self._to_float(row.get("strike_price"), 0.0)
            for key, opt in (("ce", "CE"), ("pe", "PE")):
                leg = row.get(key)
                if not isinstance(leg, dict):
                    continue
                iv = self._to_float(leg.get("iv"), 0.0)
                if iv <= 0:
                    iv = self.compute_iv(
                        spot,
                        strike,
                        actual_dte,
                        self._to_float(leg.get("ltp"), 0.0),
                        opt,
                        risk_free_rate_pct=rfr,
                        year_fraction=t,
                    )
                leg["greeks"] = self.compute_greeks(
                    spot,
                    strike,
                    actual_dte,
                    iv,
                    opt,
                    risk_free_rate_pct=rfr,
                    year_fraction=t,
                )
                leg["greeks_source"] = "calculated"

        chain_data["greeks_source"] = "calculated"
        chain_data["risk_free_rate_pct"] = rfr
        chain_data["days_to_expiry"] = actual_dte
        chain_data["year_fraction"] = t
        return chain_data


_greeks_engine = GreeksEngine()


def get_greeks_engine() -> GreeksEngine:
    return _greeks_engine
