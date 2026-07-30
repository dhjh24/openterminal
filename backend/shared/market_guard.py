"""FastAPI helpers to reject India-market requests under MARKET_PROFILE=US."""

from __future__ import annotations

from fastapi import HTTPException

from backend.shared.market_profile import (
    has_india_suffix,
    is_india_exchange,
    is_us_only,
    normalize_exchange,
    unsupported_market_detail,
)

_IN_MARKET_ALIASES = frozenset({"IN", "INDIA", "NSE", "BSE", "NFO", "MULTI", "ALL"})
_INDIA_INDEX_SYMBOLS = frozenset(
    {"NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50", "SENSEX"}
)


def assert_exchange_allowed(exchange: str | None) -> None:
    """Raise HTTP 400 when an India exchange/alias is used under US-only profile."""
    if not is_us_only():
        return
    ex = normalize_exchange(exchange)
    if not ex:
        return
    if ex in _IN_MARKET_ALIASES or is_india_exchange(ex):
        raise HTTPException(
            status_code=400,
            detail=unsupported_market_detail(exchange, input_value=exchange),
        )


def assert_symbol_allowed(symbol: str | None) -> None:
    """Raise HTTP 400 for India suffixes (.NS/.BO) or India index aliases.

    Never strips ``.NS`` / ``.BO`` to reinterpret the symbol as U.S.
    """
    if not is_us_only():
        return
    raw = (symbol or "").strip()
    if not raw:
        return
    upper = raw.upper()
    if has_india_suffix(upper):
        raise HTTPException(
            status_code=400,
            detail=unsupported_market_detail(None, input_value=upper),
        )
    # Bare India index names (no exchange param)
    base = upper.split(":", 1)[-1]
    if base in _INDIA_INDEX_SYMBOLS or upper in _INDIA_INDEX_SYMBOLS:
        raise HTTPException(
            status_code=400,
            detail=unsupported_market_detail(None, input_value=upper),
        )
    # Prefixed exchange forms: NSE:RELIANCE
    if ":" in upper:
        prefix = upper.split(":", 1)[0]
        if prefix in _IN_MARKET_ALIASES or is_india_exchange(prefix):
            raise HTTPException(
                status_code=400,
                detail=unsupported_market_detail(prefix, input_value=upper),
            )
