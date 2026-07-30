"""IV normalization + 0DTE fractional-time Greeks tests."""
from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from backend.adapters.us_options_adapter import normalize_iv_percent
from backend.fno.services.greeks_engine import (
    GreeksEngine,
    bs_days,
    year_fraction_to_expiry,
)

ET = ZoneInfo("America/New_York")


# ---------------------------------------------------------------------------
# IV — provider schema, not numeric threshold
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "provider", "expected"),
    [
        (0.25, "yfinance", 25.0),
        (0.80, "yfinance", 80.0),
        (1.00, "yahoo", 100.0),
        (1.51, "yfinance", 151.0),  # must NOT stay 1.51
        (2.00, "yfinance", 200.0),
        (0.25, "fmp", 25.0),
        (1.51, "fmp", 151.0),
        (0.0, "yfinance", 0.0),
    ],
)
def test_normalize_iv_percent_by_provider(raw, provider, expected) -> None:
    assert normalize_iv_percent(raw, provider=provider) == pytest.approx(expected)


@pytest.mark.parametrize(
    ("raw", "provider"),
    [
        (None, "yfinance"),
        (-0.1, "yfinance"),
        (float("nan"), "fmp"),
        (float("inf"), "yfinance"),
        (0.25, "unknown_vendor"),
        ("bad", "yfinance"),
    ],
)
def test_normalize_iv_percent_rejects_invalid(raw, provider) -> None:
    assert normalize_iv_percent(raw, provider=provider) is None


# ---------------------------------------------------------------------------
# Year fraction / 0DTE
# ---------------------------------------------------------------------------


def test_bs_days_no_longer_floors_zero_to_one() -> None:
    assert bs_days(0) == 0.0
    assert bs_days(-1) == 0.0
    assert bs_days(14) == 14.0


def test_year_fraction_market_open() -> None:
    # Expiry same day, quote at regular open 09:30 → ~6.5h to 16:00
    now = datetime(2026, 3, 20, 9, 30, tzinfo=ET)
    t = year_fraction_to_expiry(now=now, expiry=date(2026, 3, 20))
    expected_hours = 6.5
    assert t == pytest.approx(expected_hours / (365 * 24), rel=0.02)


def test_year_fraction_midday() -> None:
    now = datetime(2026, 3, 20, 12, 0, tzinfo=ET)
    t = year_fraction_to_expiry(now=now, expiry=date(2026, 3, 20))
    assert t == pytest.approx(4.0 / (365 * 24), rel=0.02)


def test_year_fraction_one_hour_before_close() -> None:
    now = datetime(2026, 3, 20, 15, 0, tzinfo=ET)
    t = year_fraction_to_expiry(now=now, expiry=date(2026, 3, 20))
    assert t == pytest.approx(1.0 / (365 * 24), rel=0.05)


def test_year_fraction_one_minute_before_close() -> None:
    now = datetime(2026, 3, 20, 15, 59, tzinfo=ET)
    t = year_fraction_to_expiry(now=now, expiry=date(2026, 3, 20))
    assert t == pytest.approx(1.0 / (365 * 24 * 60), rel=0.2)
    assert t > 0


def test_year_fraction_at_expiration() -> None:
    now = datetime(2026, 3, 20, 16, 0, tzinfo=ET)
    t = year_fraction_to_expiry(now=now, expiry=date(2026, 3, 20))
    assert t == 0.0


def test_year_fraction_after_expiration() -> None:
    now = datetime(2026, 3, 20, 18, 0, tzinfo=ET)
    t = year_fraction_to_expiry(now=now, expiry=date(2026, 3, 20))
    assert t == 0.0


def test_year_fraction_early_close() -> None:
    # 2026-11-27 early close 13:00
    now = datetime(2026, 11, 27, 12, 0, tzinfo=ET)
    t = year_fraction_to_expiry(now=now, expiry=date(2026, 11, 27))
    assert t == pytest.approx(1.0 / (365 * 24), rel=0.05)


def test_year_fraction_dst_edt() -> None:
    now = datetime(2026, 7, 15, 12, 0, tzinfo=ET)
    assert now.dst().total_seconds() != 0
    t = year_fraction_to_expiry(now=now, expiry=date(2026, 7, 15))
    assert t == pytest.approx(4.0 / (365 * 24), rel=0.02)


def test_zero_dte_greeks_use_fractional_time_not_full_day() -> None:
    engine = GreeksEngine(risk_free_rate_pct=4.5)
    now = datetime(2026, 3, 20, 15, 0, tzinfo=ET)
    t = year_fraction_to_expiry(now=now, expiry=date(2026, 3, 20))
    frac = engine.compute_greeks(
        spot=100.0,
        strike=100.0,
        days_to_expiry=0,
        iv=20.0,
        option_type="CE",
        risk_free_rate_pct=4.5,
        year_fraction=t,
    )
    full_day = engine.compute_greeks(
        spot=100.0,
        strike=100.0,
        days_to_expiry=1,
        iv=20.0,
        option_type="CE",
        risk_free_rate_pct=4.5,
    )
    # Near-expiry ATM call has smaller vega/theta magnitude than 1 full day.
    assert frac["vega"] < full_day["vega"]
    assert all(math.isfinite(v) for v in frac.values())


def test_expired_greeks_settled_no_nan() -> None:
    engine = GreeksEngine(risk_free_rate_pct=4.5)
    out = engine.compute_greeks(
        spot=110.0,
        strike=100.0,
        days_to_expiry=0,
        iv=20.0,
        option_type="CE",
        risk_free_rate_pct=4.5,
        year_fraction=0.0,
    )
    assert out["delta"] == 1.0
    assert out["gamma"] == 0.0
    assert all(math.isfinite(v) for v in out.values())

    put = engine.compute_greeks(
        spot=90.0,
        strike=100.0,
        days_to_expiry=0,
        iv=20.0,
        option_type="PE",
        year_fraction=0.0,
    )
    assert put["delta"] == -1.0


def test_greeks_reference_atm_30d_tolerances() -> None:
    """Reference values from mibian BS([100,100,5.0,30], vol=20) — stated tolerances."""
    import mibian  # type: ignore

    bs = mibian.BS([100.0, 100.0, 5.0, 30], volatility=20.0)
    engine = GreeksEngine(risk_free_rate_pct=5.0)
    out = engine.compute_greeks(
        spot=100.0,
        strike=100.0,
        days_to_expiry=30,
        iv=20.0,
        option_type="CE",
        risk_free_rate_pct=5.0,
    )
    assert abs(out["delta"] - float(bs.callDelta)) < 1e-4
    assert abs(out["gamma"] - float(bs.gamma)) < 1e-4
    assert abs(out["theta"] - float(bs.callTheta)) < 1e-4
    assert abs(out["vega"] - float(bs.vega)) < 1e-4
    assert abs(out["rho"] - float(bs.callRho)) < 1e-4


def test_greeks_use_configured_risk_free_rate_not_71(monkeypatch) -> None:
    monkeypatch.setenv("US_RISK_FREE_RATE", "4.5")
    engine_45 = GreeksEngine()
    g45 = engine_45.compute_greeks(
        spot=100.0,
        strike=100.0,
        days_to_expiry=30,
        iv=20.0,
        option_type="CE",
    )
    g71 = engine_45.compute_greeks(
        spot=100.0,
        strike=100.0,
        days_to_expiry=30,
        iv=20.0,
        option_type="CE",
        risk_free_rate_pct=7.1,
    )
    assert g45["delta"] != g71["delta"]


def test_compute_chain_greeks_sets_year_fraction() -> None:
    engine = GreeksEngine(risk_free_rate_pct=4.5)
    expiry = (date.today() + timedelta(days=14)).isoformat()
    chain = {
        "symbol": "SPY",
        "expiry_date": expiry,
        "spot_price": 500.0,
        "timestamp": datetime.now(ET).isoformat(),
        "strikes": [
            {
                "strike_price": 500.0,
                "ce": {"oi": 100, "volume": 50, "iv": 18.0, "ltp": 10.0},
                "pe": {"oi": 120, "volume": 60, "iv": 19.0, "ltp": 9.0},
            }
        ],
    }
    out = engine.compute_chain_greeks(chain, risk_free_rate_pct=4.5)
    assert out["greeks_source"] == "calculated"
    assert out["year_fraction"] > 0
    assert "greeks" in out["strikes"][0]["ce"]
