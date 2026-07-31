"""Unit tests for news quality controls and cascade fallback order."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from backend.services.news_cascade import NewsCascade, ProviderCode
from backend.services.news_quality import (
    build_article,
    canonical_url,
    dedupe_articles,
    freshness_label,
    is_reasonable_timestamp,
    normalize_headline,
)
from backend.services.news_provider_status import build_news_provider_status, format_news_startup_summary


def test_build_article_requires_title_url_and_rejects_future():
    future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    assert (
        build_article(
            title="Hello",
            url="https://example.com/a",
            source="Test",
            published_at=future,
            provider="finnhub",
        )
        is None
    )
    ok = build_article(
        title="Hello",
        url="https://example.com/a",
        source="Test",
        published_at=datetime.now(timezone.utc).isoformat(),
        provider="finnhub",
    )
    assert ok is not None
    assert ok["published_at"] == ok["publishedAt"]
    assert ok["provider"] == "finnhub"
    assert ok["freshness"] in {"fresh", "recent", "stale"}


def test_dedupe_merges_tickers_by_url_and_headline():
    a = build_article(
        title="Markets Rally",
        url="https://news.example/rally",
        source="A",
        published_at=datetime.now(timezone.utc).isoformat(),
        tickers=["AAPL"],
        provider="finnhub",
    )
    b = build_article(
        title="Markets Rally!!!",
        url="https://news.example/rally/",
        source="B",
        published_at=datetime.now(timezone.utc).isoformat(),
        tickers=["MSFT"],
        provider="yahoo",
        fallback_used=True,
    )
    assert a and b
    merged = dedupe_articles([a, b])
    assert len(merged) == 1
    assert set(merged[0]["tickers"]) == {"AAPL", "MSFT"}
    assert merged[0]["provider"] == "finnhub"


def test_canonical_url_and_headline_normalize():
    assert canonical_url("https://ExAmple.com/Path/") == "https://example.com/Path"
    assert canonical_url("javascript:alert(1)") == ""
    assert normalize_headline("Hello, World!!!") == "hello world"


def test_freshness_and_timestamp_gates():
    now = datetime.now(timezone.utc)
    assert freshness_label((now - timedelta(minutes=10)).isoformat(), now=now) == "fresh"
    assert freshness_label((now - timedelta(hours=10)).isoformat(), now=now) == "recent"
    assert freshness_label((now - timedelta(days=5)).isoformat(), now=now) == "stale"
    assert is_reasonable_timestamp((now + timedelta(days=2)).isoformat(), now=now) is False


def test_startup_summary_booleans_only():
    status = build_news_provider_status(finnhub_key="x", fmp_key="", news_scheduler_running=True)
    text = format_news_startup_summary(status)
    assert "Finnhub configured: yes" in text
    assert "FMP configured: no" in text
    assert "x" not in text
    assert status["finnhub_configured"] is True
    assert status["fmp_configured"] is False


@pytest.mark.asyncio
async def test_cascade_falls_through_finnhub_empty_to_fmp():
    cascade = NewsCascade()
    finnhub = SimpleNamespace(
        api_key="fh",
        get_company_news=AsyncMock(return_value=[]),
        get_market_news=AsyncMock(return_value=[]),
    )
    now = int(datetime.now(timezone.utc).timestamp())
    fmp = SimpleNamespace(
        api_key="fmp",
        get_stock_news=AsyncMock(
            return_value=[
                {
                    "title": "AAPL beats estimates",
                    "url": "https://example.com/aapl",
                    "site": "FMP",
                    "text": "Apple reported strong results",
                    "publishedDate": datetime.now(timezone.utc).isoformat(),
                    "symbol": "AAPL",
                }
            ]
        ),
        get_stock_news_latest=AsyncMock(return_value=[]),
        disabled=False,
    )
    yahoo = SimpleNamespace(search_news=AsyncMock(return_value=[]))
    fetcher = SimpleNamespace(
        finnhub=finnhub,
        fmp=fmp,
        search_news=AsyncMock(return_value=[]),
        yahoo=yahoo,
    )
    result = await cascade.fetch_symbol_news(fetcher, "AAPL", limit=10)
    assert result.winning_provider == "fmp"
    assert result.fallback_used is True
    assert result.items
    assert result.items[0]["published_at"]
    assert result.items[0]["publishedAt"]
    assert "finnhub" in result.providers_tried
    assert result.errors.get("finnhub") == ProviderCode.EMPTY.value


@pytest.mark.asyncio
async def test_cascade_uses_yahoo_when_keys_missing():
    cascade = NewsCascade()
    finnhub = SimpleNamespace(api_key="", get_company_news=AsyncMock())
    fmp = SimpleNamespace(api_key="", get_stock_news=AsyncMock())
    fetcher = SimpleNamespace(
        finnhub=finnhub,
        fmp=fmp,
        search_news=AsyncMock(
            return_value=[
                {
                    "title": "SPY climbs",
                    "link": "https://finance.yahoo.com/spy",
                    "publisher": "Yahoo Finance",
                    "summary": "ETF rises",
                    "providerPublishTime": int(datetime.now(timezone.utc).timestamp()),
                }
            ]
        ),
    )
    result = await cascade.fetch_symbol_news(fetcher, "SPY", limit=5)
    assert result.winning_provider == "yahoo"
    assert result.items[0]["provider"] == "yahoo"
    assert result.fallback_used is True
