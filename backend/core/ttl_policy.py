from __future__ import annotations

from backend.shared.market_calendar import equity_market_open_now


def market_open_now() -> bool:
    """True during the U.S. equity regular session (America/New_York)."""
    return equity_market_open_now()


def ttl_seconds(data_type: str, market_open: bool) -> int:
    dt = (data_type or "").strip().lower()
    policy: dict[str, tuple[int, int]] = {
        # Keep snapshot behavior unchanged from current code path (60s).
        "snapshot": (60, 60),
        "chart": (60, 900),
        "futures_chain": (45, 300),
        "news_latest": (180, 600),
    }
    open_ttl, closed_ttl = policy.get(dt, (300, 900))
    return open_ttl if market_open else closed_ttl
