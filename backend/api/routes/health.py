from __future__ import annotations

import time
import asyncio
from typing import Any

from fastapi import APIRouter

from backend.api.deps import get_unified_fetcher

router = APIRouter()

async def _probe(name: str, coro) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        await coro
        return {
            "name": name,
            "status": "ok",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1)
        }
    except Exception as exc:
        return {
            "name": name,
            "status": "down",
            "latency_ms": round((time.perf_counter() - started) * 1000, 1),
            "error": str(exc),
        }

@router.get("/health/datasources")
async def datasource_health() -> dict[str, Any]:
    fetcher = await get_unified_fetcher()

    checks_map = [
        _probe("yahoo", fetcher.yahoo.get_quotes(["AAPL"])),
    ]

    if fetcher.fmp.api_key:
        checks_map.append(_probe("fmp", fetcher.fmp.get_quote("AAPL")))

    if fetcher.finnhub.api_key:
        checks_map.append(_probe("finnhub", fetcher.finnhub.get_company_profile("AAPL")))

    results = await asyncio.gather(*checks_map)

    overall = "ok" if all(r["status"] == "ok" for r in results) else "degraded"
    return {"status": overall, "sources": list(results)}


@router.get("/health/news-providers")
async def news_provider_health() -> dict[str, Any]:
    """Boolean-only news provider readiness (never returns secret values)."""
    from backend.bg_services.news_ingestor import get_news_ingestor
    from backend.services.news_cascade import get_news_cascade
    from backend.services.news_provider_status import build_news_provider_status

    fetcher = await get_unified_fetcher()
    ingestor = get_news_ingestor()
    scheduler = getattr(ingestor, "_scheduler", None)
    scheduler_running = bool(scheduler is not None and getattr(scheduler, "running", False))

    cascade = get_news_cascade()
    probes = await cascade.probe_providers(fetcher)
    probe_payload = [
        {
            "name": p.name,
            "configured": p.configured,
            "status": p.status,
            "last_checked": p.last_checked,
            "last_success": p.last_success,
            "latency_ms": p.latency_ms,
            "detail": p.detail,
        }
        for p in probes
    ]
    status = build_news_provider_status(
        finnhub_key=getattr(fetcher.finnhub, "api_key", None),
        fmp_key=getattr(fetcher.fmp, "api_key", None),
        news_scheduler_running=scheduler_running,
        probes=probe_payload,
        ingest=ingestor.status_snapshot(),
    )
    return {
        "status": "ok",
        "providers": status,
        "ingest": status.get("ingest") or ingestor.status_snapshot(),
    }
