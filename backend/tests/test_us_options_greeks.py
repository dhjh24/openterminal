from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.adapters.us_options_adapter import (
    USOptionsAdapter,
    normalize_iv_percent,
)
from backend.fno.services.greeks_engine import GreeksEngine, bs_days
from backend.fno.services.option_chain_fetcher import OptionChainFetcher


# ---------------------------------------------------------------------------
# IV normalization
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "provider", "expected"),
    [
        (0.25, "yfinance", 25.0),
        (0.0, "yfinance", 0.0),
        (22.5 / 100.0, "yfinance", 22.5),
        (1.5, "yfinance", 150.0),
        (1.51, "yfinance", 151.0),
        ("0.30", "fmp", 30.0),
    ],
)
def test_normalize_iv_percent(raw, provider, expected) -> None:
    assert normalize_iv_percent(raw, provider=provider) == expected


def test_normalize_iv_percent_rejects_bad_values() -> None:
    assert normalize_iv_percent(None, provider="yfinance") is None
    assert normalize_iv_percent(-0.1, provider="yfinance") is None
    assert normalize_iv_percent("bad", provider="yfinance") is None
    assert normalize_iv_percent(0.25, provider="unknown") is None


# ---------------------------------------------------------------------------
# GreeksEngine — risk-free rate and BS math
# ---------------------------------------------------------------------------


def test_bs_days_zero_dte_does_not_floor_to_one() -> None:
    assert bs_days(0) == 0.0
    assert bs_days(-1) == 0.0
    assert bs_days(14) == 14.0


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

    engine_71 = GreeksEngine(risk_free_rate_pct=7.1)
    g71 = engine_71.compute_greeks(
        spot=100.0,
        strike=100.0,
        days_to_expiry=30,
        iv=20.0,
        option_type="CE",
        risk_free_rate_pct=7.1,
    )

    assert g45["delta"] != g71["delta"]
    assert abs(g45["delta"] - 0.54) < 0.05


def test_greeks_known_call_values() -> None:
    engine = GreeksEngine(risk_free_rate_pct=5.0)
    out = engine.compute_greeks(
        spot=100.0,
        strike=100.0,
        days_to_expiry=30,
        iv=20.0,
        option_type="CE",
        risk_free_rate_pct=5.0,
    )
    assert set(out.keys()) == {"delta", "gamma", "theta", "vega", "rho"}
    assert 0.45 < out["delta"] < 0.65
    assert out["gamma"] > 0
    assert out["vega"] > 0
    assert out["theta"] < 0


def test_greeks_known_put_values() -> None:
    engine = GreeksEngine(risk_free_rate_pct=5.0)
    out = engine.compute_greeks(
        spot=100.0,
        strike=100.0,
        days_to_expiry=30,
        iv=20.0,
        option_type="PE",
        risk_free_rate_pct=5.0,
    )
    assert -0.55 < out["delta"] < -0.35
    assert out["gamma"] > 0


def test_zero_dte_greeks_do_not_crash() -> None:
    engine = GreeksEngine(risk_free_rate_pct=4.5)
    out = engine.compute_greeks(
        spot=500.0,
        strike=500.0,
        days_to_expiry=0,
        iv=15.0,
        option_type="CE",
        risk_free_rate_pct=4.5,
    )
    assert "delta" in out


def test_compute_iv_round_trip() -> None:
    engine = GreeksEngine(risk_free_rate_pct=4.5)
    spot, strike, dte, target_iv = 150.0, 155.0, 21, 25.0
    import mibian  # type: ignore

    bs = mibian.BS([spot, strike, 4.5, bs_days(dte)], volatility=target_iv)
    call_price = float(bs.callPrice)
    solved = engine.compute_iv(
        spot, strike, dte, call_price, "CE", risk_free_rate_pct=4.5
    )
    assert abs(solved - target_iv) < 0.5


def test_compute_iv_respects_risk_free_rate(monkeypatch) -> None:
    monkeypatch.delenv("US_RISK_FREE_RATE", raising=False)
    engine = GreeksEngine(risk_free_rate_pct=4.5)
    iv_low = engine.compute_iv(100, 100, 30, 5.0, "CE", risk_free_rate_pct=4.5)
    iv_high = engine.compute_iv(100, 100, 30, 5.0, "CE", risk_free_rate_pct=7.1)
    assert iv_low != iv_high


def test_compute_chain_greeks_adds_metadata() -> None:
    engine = GreeksEngine(risk_free_rate_pct=4.5)
    expiry = (date.today() + timedelta(days=14)).isoformat()
    chain = {
        "symbol": "SPY",
        "expiry_date": expiry,
        "spot_price": 500.0,
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
    assert out["risk_free_rate_pct"] == 4.5
    assert "greeks" in out["strikes"][0]["ce"]
    assert out["strikes"][0]["ce"]["greeks_source"] == "calculated"


# ---------------------------------------------------------------------------
# USOptionsAdapter — normalize without network
# ---------------------------------------------------------------------------


def _sample_provider_rows() -> list[dict]:
    return [
        {
            "strike": 100.0,
            "type": "C",
            "impliedVolatility": 0.25,
            "lastPrice": 5.5,
            "bid": 5.4,
            "ask": 5.6,
            "volume": 1200,
            "openInterest": 5000,
            "contractSymbol": "SPY250117C00100000",
        },
        {
            "strike": 100.0,
            "type": "P",
            "impliedVolatility": 0.28,
            "lastPrice": 4.2,
            "bid": 4.1,
            "ask": 4.3,
            "volume": 800,
            "openInterest": 3000,
            "contractSymbol": "SPY250117P00100000",
        },
    ]


def test_us_adapter_normalize_iv_and_metadata() -> None:
    from zoneinfo import ZoneInfo

    adapter = USOptionsAdapter()
    et_today = datetime.now(ZoneInfo("America/New_York")).date()
    expiry = (et_today + timedelta(days=7)).isoformat()
    out = adapter._normalize_chain(
        "SPY",
        spot=100.0,
        expiry=expiry,
        data=_sample_provider_rows(),
        strike_range=0,
        source="yfinance",
        delay_status="delayed",
    )
    assert out["source"] == "yfinance"
    assert out["delay_status"] == "delayed"
    assert out["data_quality"] in {"ok", "partial"}
    assert out["greeks_source"] == "calculated"
    assert out["risk_free_rate_pct"] == adapter.risk_free_rate
    assert out["timestamp"].endswith("+00:00") or "T" in out["timestamp"]

    ce = out["strikes"][0]["ce"]
    pe = out["strikes"][0]["pe"]
    assert ce["iv"] == pytest.approx(25.0, abs=0.01)
    assert pe["iv"] == pytest.approx(28.0, abs=0.01)
    assert ce["contract_symbol"] == "SPY250117C00100000"
    assert ce["occ_symbol"] == "SPY250117C00100000"
    assert ce["greeks_source"] == "calculated"
    assert out["days_to_expiry"] == 7


def test_us_adapter_zero_dte_exposes_actual_dte() -> None:
    from zoneinfo import ZoneInfo

    adapter = USOptionsAdapter()
    expiry = datetime.now(ZoneInfo("America/New_York")).date().isoformat()
    out = adapter._normalize_chain(
        "SPY",
        spot=100.0,
        expiry=expiry,
        data=_sample_provider_rows(),
        strike_range=0,
    )
    assert out["days_to_expiry"] == 0
    assert out["strikes"][0]["ce"]["days_to_expiry"] == 0
    assert "year_fraction" in out


def test_us_adapter_crossed_market_partial_quality() -> None:
    adapter = USOptionsAdapter()
    expiry = (date.today() + timedelta(days=7)).isoformat()
    rows = [
        {
            "strike": 100.0,
            "type": "C",
            "impliedVolatility": 0.22,
            "lastPrice": 5.0,
            "bid": 5.5,
            "ask": 5.0,
            "volume": 0,
            "openInterest": 0,
        }
    ]
    out = adapter._normalize_chain("SPY", 100.0, expiry, rows, 0)
    assert out["strikes"][0]["ce"]["data_quality"] == "partial"


def test_us_adapter_empty_chain_metadata() -> None:
    adapter = USOptionsAdapter()
    out = adapter._empty_chain("SPY", "2026-01-17")
    assert out["data_quality"] == "empty"
    assert out["delay_status"] == "unavailable"
    assert out["strikes"] == []
    assert out["greeks_source"] == "calculated"


def test_us_adapter_malformed_rows_do_not_crash() -> None:
    adapter = USOptionsAdapter()
    expiry = (date.today() + timedelta(days=7)).isoformat()
    out = adapter._normalize_chain(
        "SPY",
        spot=100.0,
        expiry=expiry,
        data=[{"strike": "bad"}, {}, {"strike": 0}],
        strike_range=0,
    )
    assert out["strikes"] == []
    assert out["data_quality"] == "empty"


# ---------------------------------------------------------------------------
# OptionChainFetcher — routing / expiry helpers
# ---------------------------------------------------------------------------


def test_pick_expiry_prefers_requested() -> None:
    fetcher = OptionChainFetcher()
    available = ["2026-08-15", "2026-09-19"]
    assert fetcher._pick_expiry(available, "2026-09-19") == "2026-09-19"


def test_pick_expiry_next_future() -> None:
    fetcher = OptionChainFetcher()
    future = (date.today() + timedelta(days=30)).isoformat()
    past = (date.today() - timedelta(days=5)).isoformat()
    picked = fetcher._pick_expiry([past, future], None)
    assert picked == future


def test_is_us_symbol_detects_indices_and_exchanges() -> None:
    fetcher = OptionChainFetcher()

    class Cls:
        def __init__(self, country_code: str, exchange: str) -> None:
            self.country_code = country_code
            self.exchange = exchange

    assert fetcher._is_us_symbol("SPX", Cls("US", "CBOE")) is True
    assert fetcher._is_us_symbol("VIX", Cls("US", "CBOE")) is True
    assert fetcher._is_us_symbol("AAPL", Cls("US", "NASDAQ")) is True
    assert fetcher._is_us_symbol("FOO", Cls("US", "AMEX")) is True
    assert fetcher._is_us_symbol("NIFTY", Cls("IN", "NSE")) is False


@pytest.mark.asyncio
async def test_fetcher_us_only_rejects_india_symbol(monkeypatch) -> None:
    from fastapi import HTTPException

    monkeypatch.setenv("MARKET_PROFILE", "US")
    fetcher = OptionChainFetcher()
    with pytest.raises(HTTPException) as exc:
        await fetcher.get_option_chain("NIFTY")
    assert exc.value.status_code == 400
    detail = exc.value.detail
    assert isinstance(detail, dict)
    assert detail.get("code") == "unsupported_market" or detail.get("error") == "unsupported_market"


@pytest.mark.asyncio
async def test_fetcher_us_only_uses_us_adapter(monkeypatch) -> None:
    monkeypatch.setenv("MARKET_PROFILE", "US")
    fetcher = OptionChainFetcher()
    mock_adapter = MagicMock()
    mock_adapter.get_option_chain = AsyncMock(
        return_value={
            "symbol": "SPY",
            "market": "US",
            "spot_price": 500.0,
            "timestamp": "2026-01-01T00:00:00+00:00",
            "expiry_date": "2026-02-20",
            "days_to_expiry": 14,
            "available_expiries": [],
            "atm_strike": 500.0,
            "strikes": [],
            "totals": {
                "ce_oi_total": 0,
                "pe_oi_total": 0,
                "ce_volume_total": 0,
                "pe_volume_total": 0,
                "pcr_oi": 0.0,
                "pcr_volume": 0.0,
            },
            "source": "yfinance",
            "delay_status": "delayed",
            "data_quality": "empty",
            "greeks_source": "calculated",
            "risk_free_rate_pct": 4.5,
        }
    )
    mock_adapter.get_expiry_dates = AsyncMock(return_value=["2026-02-20"])
    fetcher._get_us_adapter = lambda: mock_adapter  # type: ignore[method-assign]
    fetcher._cache.get = AsyncMock(return_value=None)  # type: ignore[method-assign]
    fetcher._cache.set = AsyncMock()  # type: ignore[method-assign]

    with patch("backend.fno.services.option_chain_fetcher.market_open_now", return_value=False):
        out = await fetcher.get_option_chain("SPY", expiry="2026-02-20")

    mock_adapter.get_option_chain.assert_awaited_once()
    assert out["source"] == "yfinance"
    assert out["greeks_source"] == "calculated"
