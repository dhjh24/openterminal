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
