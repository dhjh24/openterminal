"""Route contract tests for U.S. news endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.routes import news as news_routes


@pytest.fixture()
def news_client():
    app = FastAPI()
    app.include_router(news_routes.router, prefix="/api")
    return TestClient(app)


def test_india_market_rejected(news_client):
    resp = news_client.get("/api/news/symbol", params={"market": "NSE", "symbol": "RELIANCE"})
    assert resp.status_code == 400
    assert "India" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_symbol_news_returns_items_and_results():
    app = FastAPI()
    app.include_router(news_routes.router, prefix="/api")
    client = TestClient(app)

    article = {
        "id": "abc",
        "title": "AAPL news",
        "url": "https://example.com/aapl",
        "source": "Finnhub",
        "summary": "summary",
        "published_at": datetime.now(timezone.utc).isoformat(),
        "publishedAt": datetime.now(timezone.utc).isoformat(),
        "tickers": ["AAPL"],
        "provider": "finnhub",
        "fallback_used": False,
        "freshness": "fresh",
        "sentiment": {"score": 0.1, "label": "Bullish", "confidence": 0.5},
    }

    fake_result = SimpleNamespace(
        items=[article],
        winning_provider="finnhub",
        fallback_used=False,
        providers_tried=["finnhub"],
        errors={},
    )
    cascade = SimpleNamespace(fetch_symbol_news=AsyncMock(return_value=fake_result))
    fetcher = SimpleNamespace()

    with patch("backend.api.routes.news.get_unified_fetcher", AsyncMock(return_value=fetcher)), patch(
        "backend.services.news_cascade.get_news_cascade", return_value=cascade
    ):
        resp = client.get("/api/news/symbol", params={"market": "NASDAQ", "symbol": "AAPL", "limit": 10})

    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body and "results" in body
    assert body["items"] == body["results"]
    assert body["items"][0]["published_at"]
    assert body["items"][0]["publishedAt"]
    assert body["meta"]["provider"] == "finnhub"


def test_market_news_503_when_empty():
    app = FastAPI()
    app.include_router(news_routes.router, prefix="/api")
    client = TestClient(app)

    fake_result = SimpleNamespace(
        items=[],
        winning_provider=None,
        fallback_used=True,
        providers_tried=["finnhub", "fmp", "yahoo", "google_rss"],
        errors={"finnhub": "empty", "yahoo": "timeout"},
    )
    cascade = SimpleNamespace(fetch_market_news=AsyncMock(return_value=fake_result))
    fetcher = SimpleNamespace()

    with patch("backend.api.routes.news.get_unified_fetcher", AsyncMock(return_value=fetcher)), patch(
        "backend.services.news_cascade.get_news_cascade", return_value=cascade
    ):
        resp = client.get("/api/news/market", params={"market": "NYSE", "limit": 10})

    assert resp.status_code == 503
    detail = resp.json()["detail"]
    assert detail["code"] == "news_unavailable"
    assert "providers_tried" in detail
