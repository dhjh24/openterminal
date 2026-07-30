"""U.S.-only market profile configuration and exchange guards.

Runtime accepts ``MARKET_PROFILE=US`` only. Profiles ``IN``, ``INDIA``,
``MULTI``, and ``ALL`` raise a configuration error at startup/resolve time.

First-release exchange coverage is limited to exchanges with tested REST and
streaming paths: **NYSE** and **NASDAQ**. AMEX/CBOE/CME are not claimed.
"""

from __future__ import annotations

import os
from typing import Final

# Supported under MARKET_PROFILE=US — must match tested REST + streaming paths.
US_SUPPORTED_EXCHANGES: Final[frozenset[str]] = frozenset({"NASDAQ", "NYSE"})

# Rejected when MARKET_PROFILE=US
INDIA_EXCHANGES: Final[frozenset[str]] = frozenset({"NSE", "BSE", "NFO"})
INDIA_SYMBOL_SUFFIXES: Final[tuple[str, ...]] = (".NS", ".BO")

FORBIDDEN_MARKET_PROFILES: Final[frozenset[str]] = frozenset(
    {"IN", "INDIA", "MULTI", "ALL"}
)

DEFAULT_COUNTRY: Final[str] = "US"
DEFAULT_CURRENCY: Final[str] = "USD"
DEFAULT_EXCHANGE: Final[str] = "NASDAQ"
DEFAULT_TIMEZONE: Final[str] = "America/New_York"

# Documented fallback when US_RISK_FREE_RATE is unset (percent, e.g. 4.5 = 4.5%).
# This is NOT a live Treasury rate — override via US_RISK_FREE_RATE.
DEFAULT_US_RISK_FREE_RATE_PCT: Final[float] = 4.5

# Safe defaults for background prefetch (overridable via PREFETCH_SYMBOLS).
DEFAULT_PREFETCH_SYMBOLS: Final[tuple[str, ...]] = (
    "SPY",
    "QQQ",
    "IWM",
    "DIA",
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "META",
    "TSLA",
)

DEFAULT_US_SYMBOLS: Final[tuple[str, ...]] = DEFAULT_PREFETCH_SYMBOLS + (
    "AMD",
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


class MarketProfileError(RuntimeError):
    """Raised when MARKET_PROFILE is not a supported U.S.-only value."""


def get_market_profile() -> str:
    """Return normalized market profile.

    Only ``US`` (and aliases USA / UNITED_STATES) is accepted.
    ``IN``, ``INDIA``, ``MULTI``, and ``ALL`` raise :class:`MarketProfileError`.
    """
    raw = (
        os.getenv("MARKET_PROFILE")
        or os.getenv("OPENTERMINALUI_MARKET_PROFILE")
        or "US"
    ).strip().upper()
    if raw in {"US", "USA", "UNITED_STATES"}:
        return "US"
    if raw in FORBIDDEN_MARKET_PROFILES:
        raise MarketProfileError(
            f"MARKET_PROFILE={raw!r} is not supported. "
            "This deployment is U.S.-only; set MARKET_PROFILE=US."
        )
    if not raw:
        return "US"
    raise MarketProfileError(
        f"Unknown MARKET_PROFILE={raw!r}. Supported value: US."
    )


def is_us_only() -> bool:
    return get_market_profile() == "US"


def get_us_risk_free_rate_pct() -> float:
    """Risk-free rate as percent for mibian (4.5 means 4.5%).

    ``US_RISK_FREE_RATE`` accepts percent (4.5) or decimal (0.045).
    When unset, returns :data:`DEFAULT_US_RISK_FREE_RATE_PCT` (fallback, not live Treasury).
    """
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


def has_india_suffix(symbol: str | None) -> bool:
    """True when the symbol carries an India Yahoo suffix (.NS / .BO)."""
    raw = (symbol or "").strip().upper()
    return any(raw.endswith(sfx) for sfx in INDIA_SYMBOL_SUFFIXES)


def unsupported_market_detail(
    exchange: str | None = None,
    *,
    input_value: str | None = None,
) -> dict[str, object]:
    """Structured error payload for India / unsupported market inputs.

    Stable fields: ``code``, ``message``, ``input``, ``allowed_markets``.
    Legacy keys (``error``, ``exchange``, …) are retained for older clients.
    """
    raw_input = (input_value if input_value is not None else exchange) or "UNKNOWN"
    ex = normalize_exchange(str(raw_input)) or str(raw_input).strip() or "UNKNOWN"
    allowed = sorted(US_SUPPORTED_EXCHANGES)
    message = (
        f"Input '{ex}' is not available under MARKET_PROFILE=US. "
        f"Allowed markets: {', '.join(allowed)}."
    )
    return {
        "code": "unsupported_market",
        "message": message,
        "input": ex,
        "allowed_markets": allowed,
        # Backward-compatible aliases
        "error": "unsupported_market",
        "exchange": ex,
        "market_profile": "US",
        "supported_exchanges": allowed,
    }
