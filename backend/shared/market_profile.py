"""U.S.-focused market profile configuration and exchange guards."""

from __future__ import annotations

import os
from typing import Final

# Supported under MARKET_PROFILE=US
US_SUPPORTED_EXCHANGES: Final[frozenset[str]] = frozenset(
    {"NASDAQ", "NYSE", "AMEX", "CBOE", "CME"}
)

# Rejected when MARKET_PROFILE=US
INDIA_EXCHANGES: Final[frozenset[str]] = frozenset({"NSE", "BSE", "NFO"})

DEFAULT_COUNTRY: Final[str] = "US"
DEFAULT_CURRENCY: Final[str] = "USD"
DEFAULT_EXCHANGE: Final[str] = "NASDAQ"
DEFAULT_TIMEZONE: Final[str] = "America/New_York"

# Documented fallback when US_RISK_FREE_RATE is unset (percent, e.g. 4.5 = 4.5%).
DEFAULT_US_RISK_FREE_RATE_PCT: Final[float] = 4.5

DEFAULT_US_SYMBOLS: Final[tuple[str, ...]] = (
    "SPY",
    "QQQ",
    "IWM",
    "DIA",
    "AAPL",
    "MSFT",
    "NVDA",
    "AMD",
    "TSLA",
    "AMZN",
    "META",
    "GOOGL",
    "SPX",
    "VIX",
)

OPTIONS_DEFAULT_SYMBOL: Final[str] = "SPY"
OPTIONS_PRESET_SYMBOLS: Final[tuple[str, ...]] = (
    "SPY",
    "QQQ",
    "IWM",
    "AAPL",
    "NVDA",
    "TSLA",
    "AMD",
)


def get_market_profile() -> str:
    """Return normalized market profile (US or legacy MULTI)."""
    raw = (
        os.getenv("MARKET_PROFILE")
        or os.getenv("OPENTERMINALUI_MARKET_PROFILE")
        or "US"
    ).strip().upper()
    if raw in {"US", "USA", "UNITED_STATES"}:
        return "US"
    if raw in {"MULTI", "IN", "INDIA", "ALL"}:
        return "MULTI"
    return "US"


def is_us_only() -> bool:
    return get_market_profile() == "US"


def get_us_risk_free_rate_pct() -> float:
    """Risk-free rate as percent for mibian (4.5 means 4.5%)."""
    raw = (
        os.getenv("US_RISK_FREE_RATE")
        or os.getenv("OPENTERMINALUI_US_RISK_FREE_RATE")
        or ""
    ).strip()
    if not raw:
        return DEFAULT_US_RISK_FREE_RATE_PCT
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return DEFAULT_US_RISK_FREE_RATE_PCT
    # Accept decimal form (0.045) or percent form (4.5).
    if 0 < value < 1:
        return value * 100.0
    if value <= 0 or value > 100:
        return DEFAULT_US_RISK_FREE_RATE_PCT
    return value


def normalize_exchange(exchange: str | None) -> str:
    return (exchange or "").strip().upper()


def is_supported_exchange(exchange: str | None) -> bool:
    ex = normalize_exchange(exchange)
    if not ex:
        return True
    if is_us_only():
        return ex in US_SUPPORTED_EXCHANGES
    return True


def is_india_exchange(exchange: str | None) -> bool:
    return normalize_exchange(exchange) in INDIA_EXCHANGES


def unsupported_market_detail(exchange: str | None) -> dict[str, object]:
    ex = normalize_exchange(exchange) or "UNKNOWN"
    return {
        "error": "unsupported_market",
        "message": (
            f"Exchange '{ex}' is not available under MARKET_PROFILE=US. "
            f"Supported exchanges: {', '.join(sorted(US_SUPPORTED_EXCHANGES))}."
        ),
        "exchange": ex,
        "market_profile": get_market_profile(),
        "supported_exchanges": sorted(US_SUPPORTED_EXCHANGES),
    }
