"""FastAPI helpers to reject India-market requests under MARKET_PROFILE=US."""

from __future__ import annotations

from fastapi import HTTPException

from backend.shared.market_profile import (
    is_india_exchange,
    is_us_only,
    normalize_exchange,
    unsupported_market_detail,
)

_IN_MARKET_ALIASES = frozenset({"IN", "INDIA", "NSE", "BSE", "NFO"})


def assert_exchange_allowed(exchange: str | None) -> None:
    """Raise HTTP 400 when an India exchange is used under US-only profile."""
    if not is_us_only():
        return
    ex = normalize_exchange(exchange)
    if not ex:
        return
    if ex in _IN_MARKET_ALIASES or is_india_exchange(ex):
        raise HTTPException(status_code=400, detail=unsupported_market_detail(exchange))
