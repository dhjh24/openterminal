"""Tests for U.S. equity market calendar (ET, holidays, early closes, DST)."""
from datetime import datetime, time
from zoneinfo import ZoneInfo

import pytest

from backend.shared.market_calendar import (
    assert_calendar_covers,
    calendar_coverage_years,
    equity_market_open_now,
    is_extended_hours,
    is_market_open,
    next_market_open,
    reload_calendar,
    session_close_at,
)

ET = ZoneInfo("America/New_York")


@pytest.fixture(autouse=True)
def _reload():
    reload_calendar()
    yield
    reload_calendar()


class TestNASDAQ:
    def test_open_during_session(self):
        dt = datetime(2026, 2, 18, 11, 0, tzinfo=ET)
        assert is_market_open("NASDAQ", dt) is True

    def test_closed_before_open(self):
        dt = datetime(2026, 2, 18, 9, 14, tzinfo=ET)
        assert is_market_open("NASDAQ", dt) is False

    def test_closed_at_boundary(self):
        dt = datetime(2026, 2, 18, 16, 0, tzinfo=ET)
        assert is_market_open("NASDAQ", dt) is False

    def test_open_at_boundary(self):
        dt = datetime(2026, 2, 18, 9, 30, tzinfo=ET)
        assert is_market_open("NASDAQ", dt) is True

    def test_closed_saturday(self):
        dt = datetime(2026, 2, 21, 11, 0, tzinfo=ET)
        assert is_market_open("NASDAQ", dt) is False

    def test_closed_sunday(self):
        dt = datetime(2026, 2, 22, 11, 0, tzinfo=ET)
        assert is_market_open("NASDAQ", dt) is False

    def test_mlk_day_holiday(self):
        dt = datetime(2026, 1, 19, 11, 0, tzinfo=ET)
        assert is_market_open("NASDAQ", dt) is False


class TestNYSE:
    def test_open_during_session(self):
        dt = datetime(2026, 2, 18, 11, 0, tzinfo=ET)
        assert is_market_open("NYSE", dt) is True

    def test_pre_market(self):
        dt = datetime(2026, 2, 18, 7, 0, tzinfo=ET)
        assert is_market_open("NYSE", dt) is False
        assert is_extended_hours("NYSE", dt) is True

    def test_after_hours(self):
        dt = datetime(2026, 2, 18, 18, 0, tzinfo=ET)
        assert is_market_open("NYSE", dt) is False
        assert is_extended_hours("NYSE", dt) is True

    def test_closed_mlk_day(self):
        dt = datetime(2026, 1, 19, 11, 0, tzinfo=ET)
        assert is_market_open("NYSE", dt) is False


class TestEarlyClose:
    def test_black_friday_early_close(self):
        # 2026-11-27 is listed as 13:00 early close
        midday = datetime(2026, 11, 27, 11, 0, tzinfo=ET)
        after_early = datetime(2026, 11, 27, 14, 0, tzinfo=ET)
        assert is_market_open("NYSE", midday) is True
        assert is_market_open("NYSE", after_early) is False
        close = session_close_at("NYSE", midday.date())
        assert close is not None
        assert close.time() == time(13, 0)

    def test_christmas_eve_early_close(self):
        before = datetime(2026, 12, 24, 12, 0, tzinfo=ET)
        after = datetime(2026, 12, 24, 13, 30, tzinfo=ET)
        assert is_market_open("NASDAQ", before) is True
        assert is_market_open("NASDAQ", after) is False


class TestDST:
    def test_edt_summer_session(self):
        # 2026-07-15 is EDT (UTC-4)
        dt = datetime(2026, 7, 15, 10, 0, tzinfo=ET)
        assert dt.dst().total_seconds() != 0
        assert is_market_open("NYSE", dt) is True
        # Same instant as 14:00 UTC
        as_utc = dt.astimezone(ZoneInfo("UTC"))
        assert as_utc.hour == 14
        assert equity_market_open_now(as_utc) is True

    def test_est_winter_session(self):
        # 2026-01-14 is EST (UTC-5)
        dt = datetime(2026, 1, 14, 10, 0, tzinfo=ET)
        assert dt.dst().total_seconds() == 0
        assert is_market_open("NYSE", dt) is True
        as_utc = dt.astimezone(ZoneInfo("UTC"))
        assert as_utc.hour == 15


class TestNextMarketOpen:
    def test_next_open_from_after_hours(self):
        dt = datetime(2026, 2, 18, 18, 0, tzinfo=ET)
        nxt = next_market_open("NASDAQ", dt)
        assert nxt.date().isoformat() == "2026-02-19"
        assert nxt.time() == time(9, 30)

    def test_next_open_from_friday_evening(self):
        dt = datetime(2026, 2, 20, 18, 0, tzinfo=ET)
        nxt = next_market_open("NASDAQ", dt)
        assert nxt.weekday() == 0

    def test_unknown_exchange_raises(self):
        with pytest.raises(ValueError, match="Unknown exchange"):
            is_market_open("FAKE", datetime.now())

    def test_cme_not_in_equity_calendar(self):
        with pytest.raises(ValueError, match="Unknown exchange"):
            is_market_open("CME", datetime(2026, 2, 18, 11, 0, tzinfo=ET))


class TestCalendarCoverage:
    def test_covers_2026(self):
        assert 2026 in calendar_coverage_years()
        assert_calendar_covers(2026)

    def test_fails_for_uncovered_year(self):
        with pytest.raises(RuntimeError, match="does not cover"):
            assert_calendar_covers(2099)
