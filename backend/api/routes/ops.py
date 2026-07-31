from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.api.deps import get_db
from backend.auth.deps import get_current_user
from backend.models import OpsKillSwitchORM, User
from backend.oms.service import log_audit
from backend.services.marketdata_hub import get_marketdata_hub
from backend.services.us_tick_stream import get_us_tick_stream_service

router = APIRouter()


class KillSwitchRequest(BaseModel):
    scope: str = Field(default="orders")
    enabled: bool
    reason: str = ""


@router.get("/ops/feed-health")
async def feed_health(_: User = Depends(get_current_user)) -> dict[str, Any]:
    hub = get_marketdata_hub()
    us_stream = get_us_tick_stream_service()
    snap = await hub.metrics_snapshot()
    ws_clients = int(snap.get("ws_connected_clients", 0))
    ws_subs = int(snap.get("ws_subscriptions", 0))
    freshness_state = "ok" if ws_clients >= 0 else "unknown"
    return {
        "feed_state": freshness_state,
        "ws_connected_clients": ws_clients,
        "ws_subscriptions": ws_subs,
        "kite_stream_status": hub.kite_stream_status(),
        "us_provider_health": us_stream.provider_health_snapshot(),
        "us_primary_provider": us_stream.primary_provider_name(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ops/data-quality")
async def ops_data_quality(_: User = Depends(get_current_user)) -> dict[str, Any]:
    us_stream = get_us_tick_stream_service()
    return await us_stream.data_quality_report()


@router.get("/ops/kill-switch")
def get_kill_switches(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict[str, Any]:
    rows = db.query(OpsKillSwitchORM).order_by(OpsKillSwitchORM.scope.asc()).all()
    return {
        "items": [
            {
                "id": row.id,
                "scope": row.scope,
                "enabled": row.enabled,
                "reason": row.reason,
                "updated_at": row.updated_at.isoformat(),
            }
            for row in rows
        ]
    }


@router.post("/ops/kill-switch")
def set_kill_switch(
    payload: KillSwitchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    row = db.query(OpsKillSwitchORM).filter(OpsKillSwitchORM.scope == payload.scope).first()
    if row is None:
        row = OpsKillSwitchORM(scope=payload.scope, enabled=payload.enabled, reason=payload.reason, updated_at=datetime.now(timezone.utc))
        db.add(row)
    else:
        row.enabled = payload.enabled
        row.reason = payload.reason
        row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    log_audit(
        db=db,
        event_type="ops_kill_switch_updated",
        entity_type="kill_switch",
        entity_id=row.id,
        payload={"scope": row.scope, "enabled": row.enabled, "reason": row.reason},
        user_id=current_user.id,
    )
    return {
        "id": row.id,
        "scope": row.scope,
        "enabled": row.enabled,
        "reason": row.reason,
        "updated_at": row.updated_at.isoformat(),
    }


@router.get("/ops/news/providers")
async def news_providers_ops(_: User = Depends(get_current_user)) -> dict[str, Any]:
    """Authenticated provider health + article inventory. Never returns secrets."""
    from datetime import timedelta

    from sqlalchemy import desc, func

    from backend.api.deps import get_unified_fetcher
    from backend.bg_services.news_ingestor import get_news_ingestor
    from backend.db.models import NewsArticle
    from backend.services.news_cascade import get_news_cascade
    from backend.services.news_provider_status import build_news_provider_status
    from backend.shared.db import SessionLocal

    fetcher = await get_unified_fetcher()
    cascade = get_news_cascade()
    ingestor = get_news_ingestor()
    scheduler = getattr(ingestor, "_scheduler", None)
    scheduler_running = bool(scheduler is not None and getattr(scheduler, "running", False))

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

    now = datetime.now(timezone.utc)
    hour_ago = (now - timedelta(hours=1)).isoformat()
    day_ago = (now - timedelta(days=1)).isoformat()
    totals: dict[str, Any] = {
        "total_articles": 0,
        "articles_last_hour": 0,
        "articles_last_day": 0,
        "newest_article_at": None,
    }
    db = SessionLocal()
    try:
        totals["total_articles"] = int(db.query(func.count(NewsArticle.id)).scalar() or 0)
        totals["articles_last_hour"] = int(
            db.query(func.count(NewsArticle.id)).filter(NewsArticle.published_at >= hour_ago).scalar() or 0
        )
        totals["articles_last_day"] = int(
            db.query(func.count(NewsArticle.id)).filter(NewsArticle.published_at >= day_ago).scalar() or 0
        )
        newest = db.query(NewsArticle).order_by(desc(NewsArticle.published_at)).first()
        if newest is not None:
            totals["newest_article_at"] = newest.published_at
    except Exception:
        pass
    finally:
        db.close()

    status = build_news_provider_status(
        finnhub_key=getattr(fetcher.finnhub, "api_key", None),
        fmp_key=getattr(fetcher.fmp, "api_key", None),
        news_scheduler_running=scheduler_running,
        probes=probe_payload,
        ingest=ingestor.status_snapshot(),
    )
    return {
        "status": "ok",
        "scheduler": {
            "running": scheduler_running,
            **ingestor.status_snapshot(),
        },
        "providers": status.get("providers") or {},
        "summary": {
            "finnhub_configured": status.get("finnhub_configured"),
            "fmp_configured": status.get("fmp_configured"),
            "yahoo_fallback": status.get("yahoo_fallback"),
            "google_news_rss_fallback": status.get("google_news_rss_fallback"),
            "news_scheduler": status.get("news_scheduler"),
            "connected_count": status.get("connected_count"),
            "provider_count": status.get("provider_count"),
        },
        "articles": totals,
    }


@router.post("/ops/news/ingest")
async def news_ingest_once(_: User = Depends(get_current_user)) -> dict[str, Any]:
    """Manual news ingestion run (authenticated). Never returns secrets."""
    from backend.bg_services.news_ingestor import get_news_ingestor

    ingestor = get_news_ingestor()
    inserted = await ingestor.ingest_once()
    return {
        "status": "ok",
        "inserted": inserted,
        "ingest": ingestor.status_snapshot(),
    }
