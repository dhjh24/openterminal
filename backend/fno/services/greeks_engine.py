from __future__ import annotations

from typing import Any

from backend.shared.market_profile import get_us_risk_free_rate_pct


def bs_days(days_to_expiry: int) -> int:
    """Calendar DTE for BS math — minimum 1 day to avoid division by zero."""
    return max(int(days_to_expiry or 0), 1)


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
            if out != out:
                return default
            return out
        except (TypeError, ValueError):
            return default

    def compute_greeks(
        self,
        spot: float,
        strike: float,
        days_to_expiry: int,
        iv: float,
        option_type: str = "CE",
        *,
        risk_free_rate_pct: float | None = None,
    ) -> dict[str, float]:
        """
        Compute Greeks for a single option.

        ``days_to_expiry`` may be 0 (0DTE); BS math uses max(dte, 1).
        ``iv`` is percent (22.5 = 22.5%).

        Returns: {"delta", "gamma", "theta", "vega", "rho"}
        """
        spot_f = max(self._to_float(spot), 0.01)
        strike_f = max(self._to_float(strike), 0.01)
        dte_bs = bs_days(days_to_expiry)
        iv_f = max(self._to_float(iv), 0.01)
        rfr = self._resolve_rfr(risk_free_rate_pct)

        try:
            import mibian  # type: ignore

            bs = mibian.BS([spot_f, strike_f, rfr, dte_bs], volatility=iv_f)
            opt = (option_type or "CE").strip().upper()
            if opt == "PE":
                delta = self._to_float(getattr(bs, "putDelta", 0.0))
                theta = self._to_float(getattr(bs, "putTheta", 0.0))
                rho = self._to_float(getattr(bs, "putRho", 0.0))
            else:
                delta = self._to_float(getattr(bs, "callDelta", 0.0))
                theta = self._to_float(getattr(bs, "callTheta", 0.0))
                rho = self._to_float(getattr(bs, "callRho", 0.0))
            gamma = self._to_float(getattr(bs, "gamma", 0.0))
            vega = self._to_float(getattr(bs, "vega", 0.0))
            return {
                "delta": round(delta, 6),
                "gamma": round(gamma, 6),
                "theta": round(theta, 6),
                "vega": round(vega, 6),
                "rho": round(rho, 6),
            }
        except Exception:
            return {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0, "rho": 0.0}

    def compute_iv(
        self,
        spot: float,
        strike: float,
        days_to_expiry: int,
        option_price: float,
        option_type: str = "CE",
        *,
        risk_free_rate_pct: float | None = None,
    ) -> float:
        """Compute implied volatility (percent) from option price using bisection."""
        target = max(self._to_float(option_price), 0.0)
        if target <= 0:
            return 0.0

        rfr = self._resolve_rfr(risk_free_rate_pct)
        dte_bs = bs_days(days_to_expiry)
        spot_f = max(self._to_float(spot), 0.01)
        strike_f = max(self._to_float(strike), 0.01)

        def _price(vol: float) -> float:
            try:
                import mibian  # type: ignore

                bs = mibian.BS(
                    [spot_f, strike_f, rfr, dte_bs],
                    volatility=max(vol, 0.01),
                )
                if (option_type or "CE").strip().upper() == "PE":
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
    ) -> dict[str, Any]:
        """Add calculated Greeks to every strike in an option chain."""
        spot = self._to_float(chain_data.get("spot_price"), 0.0)
        rfr = self._resolve_rfr(
            risk_free_rate_pct
            if risk_free_rate_pct is not None
            else chain_data.get("risk_free_rate_pct")
        )

        actual_dte = chain_data.get("days_to_expiry")
        if actual_dte is None:
            expiry = str(chain_data.get("expiry_date") or "")
            actual_dte = 0
            if expiry:
                try:
                    from datetime import date

                    actual_dte = (date.fromisoformat(expiry) - date.today()).days
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
                    )
                leg["greeks"] = self.compute_greeks(
                    spot, strike, actual_dte, iv, opt, risk_free_rate_pct=rfr
                )
                leg["greeks_source"] = "calculated"

        chain_data["greeks_source"] = "calculated"
        chain_data["risk_free_rate_pct"] = rfr
        chain_data["days_to_expiry"] = actual_dte
        return chain_data


_greeks_engine = GreeksEngine()


def get_greeks_engine() -> GreeksEngine:
    return _greeks_engine
