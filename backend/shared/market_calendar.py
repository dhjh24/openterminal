"""U.S. equity market hours calendar (America/New_York).

Supports regular sessions, weekends, holidays, early closes, premarket,
after-hours, and DST via ZoneInfo — never a fixed UTC offset.
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import NamedTuple
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

_HOLIDAYS_PATH = Path(__file__).resolve().parents[2] / "data" / "holidays.json"
ET = ZoneInfo("America/New_York")

# NYSE/NASDAQ share the equity calendar. First-release quote/stream paths
# only cover these two exchanges.
EQUITY_EXCHANGES = frozenset({"NYSE", "NASDAQ"})


class MarketSession(NamedTuple):
    tz: ZoneInfo
    open_time: time
    close_time: time
    pre_market_open: time | None = None
    after_hours_close: time | None = None


SESSIONS: dict[str, MarketSession] = {
    "NYSE": MarketSession(
        tz=ET,
        open_time=time(9, 30),
        close_time=time(16, 0),
        pre_market_open=time(4, 0),
        after_hours_close=time(20, 0),
    ),
    "NASDAQ": MarketSession(
        tz=ET,
        open_time=time(9, 30),
        close_time=time(16, 0),
        pre_market_open=time(4, 0),
        after_hours_close=time(20, 0),
    ),
}

# NYSE early closes (1:00 PM ET) — dates must be maintained yearly with holidays.json.
# Source: NYSE holiday / early-close calendar.
_EARLY_CLOSE_TIMES: dict[date, time] = {}


def _parse_date_list(raw: list[str] | None) -> set[date]:
    out: set[date] = set()
    for item in raw or []:
        try:
            out.add(date.fromisoformat(str(item)))
        except ValueError:
            logger.warning("Invalid holiday/early-close date skipped: %s", item)
    return out


def _load_calendar_file() -> dict[str, object]:
    if not _HOLIDAYS_PATH.exists():
        logger.warning("holidays.json not found at %s — no holidays loaded", _HOLIDAYS_PATH)
        return {}
    try:
        data = json.loads(_HOLIDAYS_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        logger.exception("Failed to parse holidays.json")
        return {}


_holidays_cache: dict[str, set[date]] | None = None
_early_closes_cache: dict[date, time] | None = None
_calendar_meta: dict[str, object] | None = None


def _ensure_loaded() -> None:
    global _holidays_cache, _early_closes_cache, _calendar_meta
    if _holidays_cache is not None and _early_closes_cache is not None:
        return
    raw = _load_calendar_file()
    _calendar_meta = {
        "years": raw.get("years"),
        "source": raw.get("source"),
        "updated": raw.get("updated"),
    }
    holidays: dict[str, set[date]] = {}
    for key, dates in raw.items():
        if key in {"years", "source", "updated", "early_closes"}:
            continue
        if isinstance(dates, list):
            holidays[str(key).upper()] = _parse_date_list(dates)
    # Legacy format: {"NYSE": ["YYYY-MM-DD", ...]}
    if "NYSE" not in holidays and isinstance(raw.get("NYSE"), list):
        holidays["NYSE"] = _parse_date_list(raw["NYSE"])  # type: ignore[arg-type]
    _holidays_cache = holidays

    early: dict[date, time] = dict(_EARLY_CLOSE_TIMES)
    early_raw = raw.get("early_closes")
    if isinstance(early_raw, dict):
        for day_str, close_str in early_raw.items():
            try:
                d = date.fromisoformat(str(day_str))
                parts = str(close_str).split(":")
                early[d] = time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
            except (ValueError, IndexError, TypeError):
                logger.warning("Invalid early_close entry skipped: %s=%s", day_str, close_str)
    _early_closes_cache = early


def reload_calendar() -> None:
    """Clear caches so tests / updates can reload holidays.json."""
    global _holidays_cache, _early_closes_cache, _calendar_meta
    _holidays_cache = None
    _early_closes_cache = None
    _calendar_meta = None


def _get_holidays(exchange: str) -> set[date]:
    _ensure_loaded()
    assert _holidays_cache is not None
    exchange_upper = exchange.upper()
    if exchange_upper == "NASDAQ":
        exchange_upper = "NYSE"
    return _holidays_cache.get(exchange_upper, set())


def _early_close_time(on: date) -> time | None:
    _ensure_loaded()
    assert _early_closes_cache is not None
    return _early_closes_cache.get(on)


def calendar_coverage_years() -> list[int]:
    """Years explicitly covered by holidays.json (for expiry guard tests)."""
    _ensure_loaded()
    assert _calendar_meta is not None
    years = _calendar_meta.get("years")
    if isinstance(years, list):
        return [int(y) for y in years]
    # Infer from holiday dates when years key is absent.
    dates = _get_holidays("NYSE")
    return sorted({d.year for d in dates})


def assert_calendar_covers(year: int | None = None) -> None:
    """Raise if holidays.json does not cover ``year`` (default: current ET year)."""
    target = year if year is not None else datetime.now(ET).year
    covered = calendar_coverage_years()
    if target not in covered:
        raise RuntimeError(
            f"holidays.json does not cover year {target}. "
            f"Covered years: {covered or '(none)'}. "
            "Update data/holidays.json before the calendar year rolls over "
            "(see docs/US_MARKET_MIGRATION.md)."
        )


def _session_for(exchange: str) -> MarketSession:
    ex = exchange.upper()
    session = SESSIONS.get(ex)
    if session is None:
        raise ValueError(f"Unknown exchange: {ex}")
    return session


def _localize(exchange: str, dt: datetime | None) -> datetime:
    session = _session_for(exchange)
    now = dt or datetime.now(session.tz)
    if now.tzinfo is None:
        now = now.replace(tzinfo=session.tz)
    return now.astimezone(session.tz)


def session_close_at(exchange: str, on: date) -> datetime | None:
    """Return the regular (or early) session close in America/New_York for ``on``.

    Returns None on weekends and full-day holidays.
    """
    session = _session_for(exchange)
    if on.weekday() >= 5:
        return None
    if on in _get_holidays(exchange):
        return None
    close = _early_close_time(on) or session.close_time
    return datetime(
        on.year, on.month, on.day,
        close.hour, close.minute, close.second,
        tzinfo=session.tz,
    )


def session_open_at(exchange: str, on: date) -> datetime | None:
    session = _session_for(exchange)
    if on.weekday() >= 5:
        return None
    if on in _get_holidays(exchange):
        return None
    return datetime(
        on.year, on.month, on.day,
        session.open_time.hour, session.open_time.minute,
        tzinfo=session.tz,
    )


def is_market_open(exchange: str, dt: datetime | None = None) -> bool:
    """True during the regular session (not pre/post). False on weekends/holidays."""
    ex = exchange.upper()
    session = _session_for(ex)
    local = _localize(ex, dt)

    if local.weekday() >= 5:
        return False
    if local.date() in _get_holidays(ex):
        return False

    close = _early_close_time(local.date()) or session.close_time
    t = local.time()
    return session.open_time <= t < close


def is_extended_hours(exchange: str, dt: datetime | None = None) -> bool:
    """True if in pre-market or after-hours for equity exchanges."""
    ex = exchange.upper()
    session = _session_for(ex)
    if session.pre_market_open is None:
        return False

    local = _localize(ex, dt)
    if local.weekday() >= 5:
        return False
    if local.date() in _get_holidays(ex):
        return False

    t = local.time()
    close = _early_close_time(local.date()) or session.close_time
    in_pre = session.pre_market_open <= t < session.open_time
    after_end = session.after_hours_close or close
    # On early-close days, after-hours still typically run to the usual end.
    if _early_close_time(local.date()) is not None:
        after_end = session.after_hours_close or time(20, 0)
    in_after = close <= t < after_end
    return in_pre or in_after


def next_market_open(exchange: str, dt: datetime | None = None) -> datetime:
    """Return the next regular-session open from the given point."""
    ex = exchange.upper()
    session = _session_for(ex)
    local = _localize(ex, dt)

    candidate = local.replace(
        hour=session.open_time.hour,
        minute=session.open_time.minute,
        second=0,
        microsecond=0,
    )
    if local >= candidate:
        candidate += timedelta(days=1)

    for _ in range(15):
        if candidate.weekday() < 5 and candidate.date() not in _get_holidays(ex):
            return candidate
        candidate += timedelta(days=1)

    return candidate


def equity_market_open_now(dt: datetime | None = None) -> bool:
    """Convenience: NYSE/NASDAQ regular session open right now."""
    return is_market_open("NYSE", dt)
