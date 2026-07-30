import pytest
from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi import HTTPException

from backend.services.extended_hours_service import ExtendedHoursService


@pytest.mark.asyncio
async def test_tag_session_us():
    service = ExtendedHoursService()

    # 8:00 AM ET - Pre-market
    dt = datetime(2026, 2, 24, 8, 0, tzinfo=ZoneInfo("America/New_York"))
    bar = {"time": int(dt.timestamp())}
    tagged = service._tag_session(bar, "US")
    assert tagged["session"] == "pre"
    assert tagged["isExtended"] is True

    # 10:00 AM ET - Regular
    dt = datetime(2026, 2, 24, 10, 0, tzinfo=ZoneInfo("America/New_York"))
    bar = {"time": int(dt.timestamp())}
    tagged = service._tag_session(bar, "US")
    assert tagged["session"] == "rth"
    assert tagged["isExtended"] is False

    # 6:00 PM ET - After-hours
    dt = datetime(2026, 2, 24, 18, 0, tzinfo=ZoneInfo("America/New_York"))
    bar = {"time": int(dt.timestamp())}
    tagged = service._tag_session(bar, "US")
    assert tagged["session"] == "post"
    assert tagged["isExtended"] is True


@pytest.mark.asyncio
async def test_normalize_market_defaults_to_us():
    service = ExtendedHoursService()
    session_market, hint = service._normalize_market_inputs("")
    assert session_market == "US"
    assert hint == "NASDAQ"

    session_market, hint = service._normalize_market_inputs("NASDAQ")
    assert session_market == "US"
    assert hint == "NASDAQ"


@pytest.mark.asyncio
async def test_normalize_market_rejects_india(monkeypatch):
    monkeypatch.setenv("MARKET_PROFILE", "US")
    service = ExtendedHoursService()
    for market in ("NSE", "BSE", "IN", "NFO"):
        with pytest.raises(HTTPException) as exc:
            service._normalize_market_inputs(market)
        assert exc.value.status_code == 400
