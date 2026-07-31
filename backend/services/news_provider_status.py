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
    probes: list[dict[str, Any]] | None = None,
    ingest: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return provider readiness without exposing secret values."""
    fh = finnhub_key if finnhub_key is not None else os.getenv("FINNHUB_API_KEY")
    fmp = fmp_key if fmp_key is not None else os.getenv("FMP_API_KEY")

    by_name = {str(p.get("name")): p for p in (probes or []) if isinstance(p, dict)}

    def _status_for(name: str, configured: bool, fallback: str) -> str:
        probe = by_name.get(name)
        if probe and probe.get("status"):
            return str(probe["status"])
        if not configured and name in {"finnhub", "fmp"}:
            return "missing_key"
        return fallback

    yahoo_status = _status_for("yahoo", True, "available")
    google_status = _status_for("google_rss", True, "available")
    finnhub_status = _status_for("finnhub", _configured(fh), "configured" if _configured(fh) else "missing_key")
    fmp_status = _status_for("fmp", _configured(fmp), "configured" if _configured(fmp) else "missing_key")

    providers = {
        "finnhub": {
            "configured": _configured(fh),
            "status": finnhub_status,
            "last_checked": (by_name.get("finnhub") or {}).get("last_checked"),
            "last_success": (by_name.get("finnhub") or {}).get("last_success"),
            "latency_ms": (by_name.get("finnhub") or {}).get("latency_ms"),
        },
        "fmp": {
            "configured": _configured(fmp),
            "status": fmp_status,
            "last_checked": (by_name.get("fmp") or {}).get("last_checked"),
            "last_success": (by_name.get("fmp") or {}).get("last_success"),
            "latency_ms": (by_name.get("fmp") or {}).get("latency_ms"),
        },
        "yahoo": {
            "configured": True,
            "status": yahoo_status,
            "last_checked": (by_name.get("yahoo") or {}).get("last_checked"),
            "last_success": (by_name.get("yahoo") or {}).get("last_success"),
            "latency_ms": (by_name.get("yahoo") or {}).get("latency_ms"),
        },
        "google_rss": {
            "configured": True,
            "status": google_status,
            "last_checked": (by_name.get("google_rss") or {}).get("last_checked"),
            "last_success": (by_name.get("google_rss") or {}).get("last_success"),
            "latency_ms": (by_name.get("google_rss") or {}).get("latency_ms"),
        },
    }

    connected = sum(
        1
        for p in providers.values()
        if str(p.get("status")) in {"connected", "available", "configured", "degraded"}
    )

    return {
        # Legacy flat booleans for Account / startup summary compatibility.
        "finnhub_configured": _configured(fh),
        "fmp_configured": _configured(fmp),
        "yahoo_fallback": "available" if yahoo_status in {"connected", "available", "empty"} else yahoo_status,
        "google_news_rss_fallback": (
            "available" if google_status in {"connected", "available", "empty"} else google_status
        ),
        "news_scheduler": "running" if news_scheduler_running else "stopped",
        "connected_count": connected,
        "provider_count": 4,
        "providers": providers,
        "ingest": ingest or {},
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
