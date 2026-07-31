"""U.S. news provider cascade: Finnhub → FMP → Yahoo → Google News RSS."""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from xml.etree import ElementTree as ET

import httpx

from backend.services.news_quality import build_article, dedupe_articles, strip_html, to_iso_utc
from backend.services.sentiment_engine import score_article_sentiment

logger = logging.getLogger(__name__)

US_BROAD_QUERIES = (
    "US stock market Wall Street",
    "SPY S&P 500",
    "QQQ Nasdaq",
    "US earnings economic calendar",
    "Federal Reserve market moving news",
)


class ProviderCode(str, Enum):
    CONNECTED = "connected"
    MISSING_KEY = "missing_key"
    INVALID_KEY = "invalid_key"
    FORBIDDEN_PLAN = "forbidden_plan"
    RATE_LIMITED = "rate_limited"
    TIMEOUT = "timeout"
    UNAVAILABLE = "unavailable"
    INVALID_RESPONSE = "invalid_response"
    EMPTY = "empty"
    DEGRADED = "degraded"


@dataclass
class ProviderProbe:
    name: str
    configured: bool
    status: str
    last_checked: str
    last_success: str | None = None
    detail: str | None = None
    latency_ms: float | None = None


@dataclass
class CascadeResult:
    items: list[dict[str, Any]] = field(default_factory=list)
    providers_tried: list[str] = field(default_factory=list)
    winning_provider: str | None = None
    fallback_used: bool = False
    errors: dict[str, str] = field(default_factory=dict)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sentiment(title: str, summary: str) -> dict[str, Any] | None:
    text = f"{title or ''}. {summary or ''}".strip()
    if len(text) < 3:
        return None
    return score_article_sentiment(text)


def _classify_http_error(status: int, *, has_key: bool) -> ProviderCode:
    if status in (401, 403) and not has_key:
        return ProviderCode.MISSING_KEY
    if status == 401:
        return ProviderCode.INVALID_KEY
    if status == 403:
        return ProviderCode.FORBIDDEN_PLAN
    if status == 402:
        return ProviderCode.FORBIDDEN_PLAN
    if status == 429:
        return ProviderCode.RATE_LIMITED
    if status >= 500:
        return ProviderCode.UNAVAILABLE
    return ProviderCode.INVALID_RESPONSE


def _safe_error_code(exc: BaseException) -> ProviderCode:
    if isinstance(exc, httpx.TimeoutException):
        return ProviderCode.TIMEOUT
    if isinstance(exc, httpx.HTTPStatusError):
        return _classify_http_error(exc.response.status_code, has_key=True)
    return ProviderCode.UNAVAILABLE


class NewsCascade:
    """Fetch and merge U.S. news across providers with cooldowns."""

    ORDER = ("finnhub", "fmp", "yahoo", "google_rss")

    def __init__(self) -> None:
        self._cooldowns: dict[str, float] = {}
        self._last_success: dict[str, str] = {}
        self._last_status: dict[str, str] = {
            "finnhub": ProviderCode.MISSING_KEY.value,
            "fmp": ProviderCode.MISSING_KEY.value,
            "yahoo": ProviderCode.UNAVAILABLE.value,
            "google_rss": ProviderCode.UNAVAILABLE.value,
        }

    def _on_cooldown(self, name: str) -> bool:
        until = self._cooldowns.get(name, 0.0)
        return until > datetime.now(timezone.utc).timestamp()

    def _set_cooldown(self, name: str, seconds: float) -> None:
        self._cooldowns[name] = datetime.now(timezone.utc).timestamp() + seconds

    def _mark(self, name: str, code: ProviderCode, *, success: bool = False) -> None:
        self._last_status[name] = code.value
        if success:
            self._last_success[name] = _now_iso()

    async def fetch_symbol_news(self, fetcher: Any, symbol: str, limit: int = 30) -> CascadeResult:
        ticker = symbol.strip().upper()
        result = CascadeResult()
        if not ticker:
            return result

        # 1. Finnhub company news
        if not self._on_cooldown("finnhub") and getattr(getattr(fetcher, "finnhub", None), "api_key", ""):
            result.providers_tried.append("finnhub")
            try:
                rows = await asyncio.wait_for(fetcher.finnhub.get_company_news(ticker, limit=limit), timeout=12.0)
                items = self._normalize_finnhub(rows, tickers=[ticker], fallback=False)
                if items:
                    self._mark("finnhub", ProviderCode.CONNECTED, success=True)
                    result.items = items[:limit]
                    result.winning_provider = "finnhub"
                    return result
                self._mark("finnhub", ProviderCode.EMPTY)
                result.errors["finnhub"] = ProviderCode.EMPTY.value
            except Exception as exc:
                code = _safe_error_code(exc)
                self._mark("finnhub", code)
                result.errors["finnhub"] = code.value
                if code in {ProviderCode.RATE_LIMITED, ProviderCode.FORBIDDEN_PLAN, ProviderCode.INVALID_KEY}:
                    self._set_cooldown("finnhub", 300)

        # 2. FMP stock news
        if not self._on_cooldown("fmp") and getattr(getattr(fetcher, "fmp", None), "api_key", ""):
            result.providers_tried.append("fmp")
            try:
                rows = await asyncio.wait_for(fetcher.fmp.get_stock_news(ticker, limit=limit), timeout=12.0)
                items = self._normalize_fmp(rows, tickers=[ticker], fallback=True)
                if items:
                    self._mark("fmp", ProviderCode.CONNECTED, success=True)
                    result.items = items[:limit]
                    result.winning_provider = "fmp"
                    result.fallback_used = True
                    return result
                self._mark("fmp", ProviderCode.EMPTY)
                result.errors["fmp"] = ProviderCode.EMPTY.value
            except Exception as exc:
                code = _safe_error_code(exc)
                self._mark("fmp", code)
                result.errors["fmp"] = code.value
                if code in {ProviderCode.RATE_LIMITED, ProviderCode.FORBIDDEN_PLAN, ProviderCode.INVALID_KEY}:
                    self._set_cooldown("fmp", 300)

        # 3. Yahoo search
        for term in (f"{ticker} stock", ticker, f"{ticker} earnings"):
            items = await self._fetch_yahoo(fetcher, term, limit=limit, tickers=[ticker], result=result)
            if items:
                result.items = items[:limit]
                result.winning_provider = "yahoo"
                result.fallback_used = True
                return result

        # 4. Google RSS
        items = await self._fetch_google_rss(f"{ticker} stock NYSE NASDAQ", limit=limit, tickers=[ticker], result=result)
        if items:
            result.items = items[:limit]
            result.winning_provider = "google_rss"
            result.fallback_used = True
        return result

    async def fetch_market_news(self, fetcher: Any, limit: int = 30) -> CascadeResult:
        result = CascadeResult()

        if not self._on_cooldown("finnhub") and getattr(getattr(fetcher, "finnhub", None), "api_key", ""):
            result.providers_tried.append("finnhub")
            try:
                rows = await asyncio.wait_for(
                    fetcher.finnhub.get_market_news(category="general", limit=limit),
                    timeout=12.0,
                )
                items = self._normalize_finnhub(rows, fallback=False)
                if items:
                    self._mark("finnhub", ProviderCode.CONNECTED, success=True)
                    result.items = items[:limit]
                    result.winning_provider = "finnhub"
                    return result
                self._mark("finnhub", ProviderCode.EMPTY)
                result.errors["finnhub"] = ProviderCode.EMPTY.value
            except Exception as exc:
                code = _safe_error_code(exc)
                self._mark("finnhub", code)
                result.errors["finnhub"] = code.value
                if code in {ProviderCode.RATE_LIMITED, ProviderCode.FORBIDDEN_PLAN, ProviderCode.INVALID_KEY}:
                    self._set_cooldown("finnhub", 300)

        if not self._on_cooldown("fmp") and getattr(getattr(fetcher, "fmp", None), "api_key", ""):
            result.providers_tried.append("fmp")
            try:
                rows = await asyncio.wait_for(fetcher.fmp.get_stock_news_latest(limit=limit), timeout=12.0)
                items = self._normalize_fmp(rows, fallback=True)
                if items:
                    self._mark("fmp", ProviderCode.CONNECTED, success=True)
                    result.items = items[:limit]
                    result.winning_provider = "fmp"
                    result.fallback_used = True
                    return result
                self._mark("fmp", ProviderCode.EMPTY)
                result.errors["fmp"] = ProviderCode.EMPTY.value
            except Exception as exc:
                code = _safe_error_code(exc)
                self._mark("fmp", code)
                result.errors["fmp"] = code.value
                if code in {ProviderCode.RATE_LIMITED, ProviderCode.FORBIDDEN_PLAN, ProviderCode.INVALID_KEY}:
                    self._set_cooldown("fmp", 300)

        for query in US_BROAD_QUERIES:
            items = await self._fetch_yahoo(fetcher, query, limit=limit, result=result)
            if items:
                result.items = items[:limit]
                result.winning_provider = "yahoo"
                result.fallback_used = True
                return result

        for query in US_BROAD_QUERIES[:2]:
            items = await self._fetch_google_rss(query, limit=limit, result=result)
            if items:
                result.items = items[:limit]
                result.winning_provider = "google_rss"
                result.fallback_used = True
                return result
        return result

    async def fetch_query_news(self, fetcher: Any, query: str, limit: int = 50) -> CascadeResult:
        result = CascadeResult()
        q = (query or "").strip()
        if not q:
            return result

        items = await self._fetch_yahoo(fetcher, q, limit=limit, result=result)
        if items:
            result.items = items[:limit]
            result.winning_provider = "yahoo"
            result.fallback_used = True
            return result

        items = await self._fetch_google_rss(q, limit=limit, result=result)
        if items:
            result.items = items[:limit]
            result.winning_provider = "google_rss"
            result.fallback_used = True
        return result

    async def fetch_broad_us_news(self, fetcher: Any, limit: int = 50) -> CascadeResult:
        merged: list[dict[str, Any]] = []
        result = CascadeResult()
        market = await self.fetch_market_news(fetcher, limit=limit)
        result.providers_tried.extend(market.providers_tried)
        result.errors.update(market.errors)
        merged.extend(market.items)
        for query in US_BROAD_QUERIES:
            part = await self.fetch_query_news(fetcher, query, limit=max(10, limit // 3))
            result.providers_tried.extend(part.providers_tried)
            result.errors.update(part.errors)
            merged.extend(part.items)
        items = dedupe_articles(merged)[:limit]
        result.items = items
        result.winning_provider = market.winning_provider or (items[0].get("provider") if items else None)
        result.fallback_used = bool(market.fallback_used or (result.winning_provider in {"yahoo", "google_rss", "fmp"}))
        return result

    async def _fetch_yahoo(
        self,
        fetcher: Any,
        query: str,
        *,
        limit: int,
        tickers: list[str] | None = None,
        result: CascadeResult,
    ) -> list[dict[str, Any]]:
        if self._on_cooldown("yahoo"):
            return []
        if "yahoo" not in result.providers_tried:
            result.providers_tried.append("yahoo")
        try:
            rows = await asyncio.wait_for(fetcher.search_news(query, limit=limit), timeout=10.0)
            if not isinstance(rows, list):
                self._mark("yahoo", ProviderCode.INVALID_RESPONSE)
                result.errors["yahoo"] = ProviderCode.INVALID_RESPONSE.value
                return []
            # Detect HTML / crumb failure shapes without leaking bodies.
            if rows and all(isinstance(r, dict) and ("html" in r or "crumb" in str(r).lower()) for r in rows[:3]):
                self._mark("yahoo", ProviderCode.INVALID_RESPONSE)
                result.errors["yahoo"] = ProviderCode.INVALID_RESPONSE.value
                self._set_cooldown("yahoo", 120)
                return []
            items = self._normalize_yahoo(rows, tickers=tickers, fallback=True)
            if items:
                self._mark("yahoo", ProviderCode.CONNECTED, success=True)
                return items
            self._mark("yahoo", ProviderCode.EMPTY)
            result.errors["yahoo"] = ProviderCode.EMPTY.value
            return []
        except Exception as exc:
            code = _safe_error_code(exc)
            self._mark("yahoo", code)
            result.errors["yahoo"] = code.value
            if code == ProviderCode.RATE_LIMITED:
                self._set_cooldown("yahoo", 180)
            return []

    async def _fetch_google_rss(
        self,
        query: str,
        *,
        limit: int,
        tickers: list[str] | None = None,
        result: CascadeResult,
    ) -> list[dict[str, Any]]:
        if self._on_cooldown("google_rss"):
            return []
        if "google_rss" not in result.providers_tried:
            result.providers_tried.append("google_rss")
        q = (query or "").strip()
        if not q:
            return []
        url = "https://news.google.com/rss/search"
        params = {"q": q, "hl": "en-US", "gl": "US", "ceid": "US:en"}
        try:
            async with httpx.AsyncClient(timeout=8.0, trust_env=False, follow_redirects=True) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 429:
                    self._mark("google_rss", ProviderCode.RATE_LIMITED)
                    result.errors["google_rss"] = ProviderCode.RATE_LIMITED.value
                    self._set_cooldown("google_rss", 180)
                    return []
                resp.raise_for_status()
                text = resp.text or ""
                if "<rss" not in text.lower() and "<feed" not in text.lower():
                    self._mark("google_rss", ProviderCode.INVALID_RESPONSE)
                    result.errors["google_rss"] = ProviderCode.INVALID_RESPONSE.value
                    return []
                root = ET.fromstring(text)
        except ET.ParseError:
            self._mark("google_rss", ProviderCode.INVALID_RESPONSE)
            result.errors["google_rss"] = ProviderCode.INVALID_RESPONSE.value
            return []
        except Exception as exc:
            code = _safe_error_code(exc)
            self._mark("google_rss", code)
            result.errors["google_rss"] = code.value
            return []

        out: list[dict[str, Any]] = []
        for node in root.findall(".//item"):
            title = (node.findtext("title") or "").strip()
            link = (node.findtext("link") or "").strip()
            summary = strip_html((node.findtext("description") or "").strip())
            source = (node.findtext("source") or "").strip() or "Google News"
            published = to_iso_utc(node.findtext("pubDate"))
            article = build_article(
                title=title,
                url=link,
                source=source,
                published_at=published,
                summary=summary,
                tickers=tickers,
                provider="google_rss",
                sentiment=_sentiment(title, summary),
                fallback_used=True,
            )
            if article:
                out.append(article)
            if len(out) >= limit:
                break
        if out:
            self._mark("google_rss", ProviderCode.CONNECTED, success=True)
        else:
            self._mark("google_rss", ProviderCode.EMPTY)
            result.errors["google_rss"] = ProviderCode.EMPTY.value
        return dedupe_articles(out)

    def _normalize_finnhub(
        self,
        rows: Any,
        *,
        tickers: list[str] | None = None,
        fallback: bool,
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        if not isinstance(rows, list):
            return out
        for row in rows:
            if not isinstance(row, dict):
                continue
            title = str(row.get("headline") or row.get("title") or "").strip()
            url = str(row.get("url") or row.get("link") or "").strip()
            summary = str(row.get("summary") or row.get("text") or "").strip()
            source = str(row.get("source") or "Finnhub").strip() or "Finnhub"
            related = str(row.get("related") or "").strip()
            row_tickers = [t.strip().upper() for t in related.split(",") if t.strip()] if related else []
            if tickers:
                row_tickers = list(dict.fromkeys([*tickers, *row_tickers]))
            article = build_article(
                title=title,
                url=url,
                source=source,
                published_at=to_iso_utc(row.get("datetime")) or to_iso_utc(row.get("publishedAt")),
                summary=summary,
                image_url=str(row.get("image") or "").strip(),
                tickers=row_tickers,
                provider="finnhub",
                sentiment=_sentiment(title, summary),
                fallback_used=fallback,
            )
            if article:
                out.append(article)
        return dedupe_articles(out)

    def _normalize_fmp(
        self,
        rows: Any,
        *,
        tickers: list[str] | None = None,
        fallback: bool,
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        if not isinstance(rows, list):
            return out
        for row in rows:
            if not isinstance(row, dict):
                continue
            title = str(row.get("title") or row.get("headline") or "").strip()
            url = str(row.get("url") or row.get("link") or "").strip()
            summary = str(row.get("text") or row.get("summary") or "").strip()
            source = str(row.get("site") or row.get("source") or "FMP").strip() or "FMP"
            sym = str(row.get("symbol") or row.get("ticker") or "").strip().upper()
            row_tickers = [sym] if sym else []
            if tickers:
                row_tickers = list(dict.fromkeys([*tickers, *row_tickers]))
            article = build_article(
                title=title,
                url=url,
                source=source,
                published_at=to_iso_utc(row.get("publishedDate") or row.get("publishedAt")),
                summary=summary,
                image_url=str(row.get("image") or row.get("image_url") or "").strip(),
                tickers=row_tickers,
                provider="fmp",
                sentiment=_sentiment(title, summary),
                fallback_used=fallback,
            )
            if article:
                out.append(article)
        return dedupe_articles(out)

    def _normalize_yahoo(
        self,
        rows: Any,
        *,
        tickers: list[str] | None = None,
        fallback: bool,
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        if not isinstance(rows, list):
            return out
        for row in rows:
            if not isinstance(row, dict):
                continue
            title = str(row.get("title") or "").strip()
            url = str(row.get("link") or row.get("url") or "").strip()
            summary = strip_html(str(row.get("summary") or row.get("description") or "").strip())
            source = str(row.get("publisher") or row.get("source") or "Yahoo Finance").strip() or "Yahoo Finance"
            article = build_article(
                title=title,
                url=url,
                source=source,
                published_at=to_iso_utc(row.get("providerPublishTime")) or to_iso_utc(row.get("pubDate")),
                summary=summary,
                tickers=tickers,
                provider="yahoo",
                sentiment=_sentiment(title, summary),
                fallback_used=fallback,
            )
            if article:
                out.append(article)
        return dedupe_articles(out)

    async def probe_providers(self, fetcher: Any) -> list[ProviderProbe]:
        checked = _now_iso()
        probes: list[ProviderProbe] = []

        fh_key = bool(str(getattr(getattr(fetcher, "finnhub", None), "api_key", "") or "").strip())
        fmp_key = bool(str(getattr(getattr(fetcher, "fmp", None), "api_key", "") or "").strip())

        # Finnhub
        if not fh_key:
            probes.append(
                ProviderProbe("finnhub", False, ProviderCode.MISSING_KEY.value, checked)
            )
        else:
            started = datetime.now(timezone.utc)
            try:
                rows = await asyncio.wait_for(fetcher.finnhub.get_market_news(limit=3), timeout=8.0)
                latency = (datetime.now(timezone.utc) - started).total_seconds() * 1000
                if isinstance(rows, list) and rows:
                    self._mark("finnhub", ProviderCode.CONNECTED, success=True)
                    probes.append(
                        ProviderProbe(
                            "finnhub",
                            True,
                            ProviderCode.CONNECTED.value,
                            checked,
                            self._last_success.get("finnhub"),
                            latency_ms=round(latency, 1),
                        )
                    )
                else:
                    self._mark("finnhub", ProviderCode.EMPTY)
                    probes.append(
                        ProviderProbe("finnhub", True, ProviderCode.EMPTY.value, checked, latency_ms=round(latency, 1))
                    )
            except Exception as exc:
                code = _safe_error_code(exc)
                self._mark("finnhub", code)
                probes.append(ProviderProbe("finnhub", True, code.value, checked, detail=code.value))

        # FMP
        if not fmp_key:
            probes.append(ProviderProbe("fmp", False, ProviderCode.MISSING_KEY.value, checked))
        else:
            started = datetime.now(timezone.utc)
            try:
                rows = await asyncio.wait_for(fetcher.fmp.get_stock_news_latest(limit=3), timeout=8.0)
                latency = (datetime.now(timezone.utc) - started).total_seconds() * 1000
                if isinstance(rows, list) and rows:
                    self._mark("fmp", ProviderCode.CONNECTED, success=True)
                    probes.append(
                        ProviderProbe(
                            "fmp",
                            True,
                            ProviderCode.CONNECTED.value,
                            checked,
                            self._last_success.get("fmp"),
                            latency_ms=round(latency, 1),
                        )
                    )
                else:
                    # Empty can mean plan restriction for news endpoints.
                    status = ProviderCode.EMPTY.value
                    if getattr(fetcher.fmp, "disabled", False):
                        status = ProviderCode.INVALID_KEY.value
                    self._mark("fmp", ProviderCode(status) if status in ProviderCode._value2member_map_ else ProviderCode.EMPTY)
                    probes.append(
                        ProviderProbe("fmp", True, status, checked, latency_ms=round(latency, 1))
                    )
            except Exception as exc:
                code = _safe_error_code(exc)
                self._mark("fmp", code)
                probes.append(ProviderProbe("fmp", True, code.value, checked, detail=code.value))

        # Yahoo
        started = datetime.now(timezone.utc)
        try:
            rows = await asyncio.wait_for(fetcher.search_news("SPY stock", limit=3), timeout=8.0)
            latency = (datetime.now(timezone.utc) - started).total_seconds() * 1000
            items = self._normalize_yahoo(rows, fallback=True)
            if items:
                self._mark("yahoo", ProviderCode.CONNECTED, success=True)
                probes.append(
                    ProviderProbe(
                        "yahoo",
                        True,
                        ProviderCode.CONNECTED.value,
                        checked,
                        self._last_success.get("yahoo"),
                        latency_ms=round(latency, 1),
                    )
                )
            else:
                self._mark("yahoo", ProviderCode.EMPTY)
                probes.append(ProviderProbe("yahoo", True, ProviderCode.EMPTY.value, checked, latency_ms=round(latency, 1)))
        except Exception as exc:
            code = _safe_error_code(exc)
            self._mark("yahoo", code)
            probes.append(ProviderProbe("yahoo", True, code.value, checked, detail=code.value))

        # Google RSS
        google_result = CascadeResult()
        started = datetime.now(timezone.utc)
        items = await self._fetch_google_rss("US stock market", limit=3, result=google_result)
        latency = (datetime.now(timezone.utc) - started).total_seconds() * 1000
        status = self._last_status.get("google_rss", ProviderCode.UNAVAILABLE.value)
        if items:
            status = ProviderCode.CONNECTED.value
        probes.append(
            ProviderProbe(
                "google_rss",
                True,
                status,
                checked,
                self._last_success.get("google_rss"),
                latency_ms=round(latency, 1),
            )
        )
        return probes


_cascade: NewsCascade | None = None


def get_news_cascade() -> NewsCascade:
    global _cascade
    if _cascade is None:
        _cascade = NewsCascade()
    return _cascade


def resolve_provider_api_key(*env_names: str, settings_value: str | None = None) -> str:
    """Prefer process env, then settings value. Never logs the value."""
    for name in env_names:
        raw = (os.getenv(name) or "").strip()
        if raw:
            return raw
    return (settings_value or "").strip()
