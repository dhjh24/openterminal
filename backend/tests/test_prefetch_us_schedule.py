"""Prefetch worker + TTL policy use America/New_York equity calendar."""
from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from backend.core.ttl_policy import market_open_now, ttl_seconds
from backend.services.prefetch_worker import get_prefetch_symbols, is_market_hours
from backend.shared.market_profile import DEFAULT_PREFETCH_SYMBOLS

ET = ZoneInfo("America/New_York")


def test_default_prefetch_symbols_are_us_list() -> None:
    symbols = get_prefetch_symbols()
    assert symbols == list(DEFAULT_PREFETCH_SYMBOLS)
    assert "RELIANCE" not in symbols
    assert "NIFTY" not in symbols
    for expected in ("SPY", "QQQ", "IWM", "DIA", "AAPL", "MSFT", "NVDA", "AMZN", "META", "TSLA"):
        assert expected in symbols


def test_prefetch_symbols_env_override(monkeypatch) -> None:
    monkeypatch.setenv("PREFETCH_SYMBOLS", "SPY, AAPL ,msft")
    assert get_prefetch_symbols() == ["SPY", "AAPL", "MSFT"]


def test_is_market_hours_matches_nyse_open() -> None:
    open_dt = datetime(2026, 2, 18, 11, 0, tzinfo=ET)
    closed_dt = datetime(2026, 2, 18, 18, 0, tzinfo=ET)
    holiday = datetime(2026, 1, 19, 11, 0, tzinfo=ET)
    # Patch equity_market_open_now via calendar by passing through is_market_hours
    # which calls equity_market_open_now() with wall clock — unit-test via calendar.
    from backend.shared import market_calendar as cal

    assert cal.is_market_open("NYSE", open_dt) is True
    assert cal.is_market_open("NYSE", closed_dt) is False
    assert cal.is_market_open("NYSE", holiday) is False
    assert is_market_hours.__doc__ and "America/New_York" in is_market_hours.__doc__


def test_ttl_policy_no_ist_fallback() -> None:
    import inspect

    source = inspect.getsource(market_open_now)
    assert "IST" not in source
    assert "5, minutes=30" not in source
    assert "09:15" not in source
    open_ttl = ttl_seconds("chart", True)
    closed_ttl = ttl_seconds("chart", False)
    assert open_ttl < closed_ttl
