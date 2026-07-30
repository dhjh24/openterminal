"""Safe news-provider configuration / runtime status (booleans only — never secrets)."""

from __future__ import annotations

import os
from typing import Any


def _configured(value: str | None) -> bool:
    return bool((value or "").strip())


def build_news_provider_status(
    *,
    finnhub_key: str | None = None,
    fmp_key: str | None = None,
    news_scheduler_running: bool | None = None,
) -> dict[str, Any]:
    """Return provider readiness without exposing secret values."""
    fh = finnhub_key if finnhub_key is not None else os.getenv("FINNHUB_API_KEY")
    fmp = fmp_key if fmp_key is not None else os.getenv("FMP_API_KEY")
    return {
        "finnhub_configured": _configured(fh),
        "fmp_configured": _configured(fmp),
        "yahoo_fallback": "available",
        "google_news_rss_fallback": "available",
        "news_scheduler": "running" if news_scheduler_running else "stopped",
    }


def format_news_startup_summary(status: dict[str, Any]) -> str:
    return "\n".join(
        [
            f"Finnhub configured: {'yes' if status.get('finnhub_configured') else 'no'}",
            f"FMP configured: {'yes' if status.get('fmp_configured') else 'no'}",
            f"Yahoo fallback: {status.get('yahoo_fallback', 'unavailable')}",
            f"Google News RSS fallback: {status.get('google_news_rss_fallback', 'unavailable')}",
            f"News scheduler: {status.get('news_scheduler', 'stopped')}",
        ]
    )
