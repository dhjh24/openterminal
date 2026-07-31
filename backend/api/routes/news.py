from __future__ import annotations

import hashlib
import html
import json
import re
import asyncio
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import desc, or_
from sqlalchemy.exc import OperationalError
import httpx

from backend.api.deps import cache_instance, fetch_stock_snapshot_coalesced, get_unified_fetcher
from backend.core.ttl_policy import market_open_now, ttl_seconds
from backend.services.sentiment_engine import score_article_sentiment
from backend.shared.db import SessionLocal
from backend.db.models import NewsArticle

router = APIRouter()

US_MARKETS = {"NYSE", "NASDAQ", "US"}
SUPPORTED_MARKETS = US_MARKETS

_HTML_RE = re.compile(r"<[^>]+>")


def _to_iso_from_epoch(value: Any) -> str | None:
    try:
        epoch = int(value)
    except (TypeError, ValueError):
        return None
    if epoch <= 0:
        return None
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()


def _stable_id(url: str, title: str, published_at: str) -> str:
    key = f"{url}|{title}|{published_at}".encode("utf-8")
    return hashlib.sha1(key).hexdigest()[:16]


def _normalize_items(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Normalize provider rows into the canonical article shape (both timestamp keys)."""
    from backend.services.news_cascade import NewsCascade

    cascade = NewsCascade()
    # Heuristic: Finnhub-shaped rows have datetime/headline; FMP has publishedDate/site.
    if rows and isinstance(rows[0], dict) and ("datetime" in rows[0] or "headline" in rows[0]):
        return cascade._normalize_finnhub(rows, fallback=False)
    if rows and isinstance(rows[0], dict) and ("publishedDate" in rows[0] or "site" in rows[0]):
        return cascade._normalize_fmp(rows, fallback=True)
    return cascade._normalize_yahoo(rows, fallback=True)


def _row_to_item(row: NewsArticle) -> dict[str, Any]:
    from backend.services.news_quality import build_article, freshness_label

    tickers: list[str] = []
    try:
        parsed = json.loads(row.tickers or "[]")
        if isinstance(parsed, list):
            tickers = [str(v).upper() for v in parsed if str(v).strip()]
    except Exception:
        tickers = []
    sentiment = _row_sentiment(row)
    article = build_article(
        title=row.title or "",
        url=row.url or "",
        source=row.source or "Unknown",
        published_at=row.published_at,
        summary=row.summary or "",
        image_url=row.image_url or "",
        tickers=tickers,
        provider=str(getattr(row, "provider", None) or row.source or "database"),
        sentiment=sentiment,
        fallback_used=False,
    )
    if article:
        article["id"] = row.id or article["id"]
        article["freshness"] = freshness_label(str(article.get("published_at") or ""))
        return article
    # Fallback minimal payload if quality gate rejects (keep feed non-empty for legacy rows).
    ts = row.published_at or datetime.now(timezone.utc).isoformat()
    return {
        "id": row.id,
        "source": row.source,
        "title": row.title,
        "url": row.url,
        "summary": row.summary,
        "image_url": row.image_url,
        "published_at": ts,
        "publishedAt": ts,
        "tickers": tickers,
        "sentiment": sentiment,
        "provider": "database",
        "fallback_used": False,
        "freshness": freshness_label(ts),
    }


def _compose_news_text(title: str, summary: str) -> str:
    return f"{title or ''}. {summary or ''}".strip()


def _row_sentiment(row: NewsArticle) -> dict[str, Any]:
    if row.sentiment_label and row.sentiment_score is not None and row.sentiment_confidence is not None:
        return {
            "score": float(row.sentiment_score),
            "label": str(row.sentiment_label),
            "confidence": float(row.sentiment_confidence),
        }
    return score_article_sentiment(_compose_news_text(row.title, row.summary))


def _label_from_score(score: float) -> str:
    if score > 0.1:
        return "Bullish"
    if score < -0.1:
        return "Bearish"
    return "Neutral"


def _to_day(value: str) -> str | None:
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date().isoformat()
    except Exception:
        return None


def _ticker_aliases(symbol: str, market: str | None = None) -> list[str]:
    base = symbol.strip().upper()
    if not base:
        return []
    # U.S.-only: bare ticker (no .NS / .BO India aliases).
    _ = market  # retained for call-site compatibility
    return [base]


def _ticker_fallback_terms(symbol: str, market: str | None = None) -> list[str]:
    base = symbol.strip().upper()
    _ = market
    return list(dict.fromkeys([f"{base} stock", f"{base} earnings", base, f"{base} NYSE NASDAQ"]))


def _validate_market(market: str) -> str:
    market_code = market.strip().upper()
    # Map legacy India codes to US so old clients do not hard-fail.
    if market_code in {"NSE", "BSE", "IN", "INDIA"}:
        raise HTTPException(status_code=400, detail="India markets are not supported. Use NYSE or NASDAQ.")
    if market_code not in SUPPORTED_MARKETS:
        raise HTTPException(status_code=400, detail=f"Unsupported market: {market_code}")
    return "NASDAQ" if market_code == "US" else market_code


def _strip_html(text: str) -> str:
    clean = _HTML_RE.sub(" ", text or "")
    clean = html.unescape(clean)
    return " ".join(clean.split()).strip()


def _to_iso_from_rss_date(raw: str | None) -> str:
    if not raw:
        return datetime.now(timezone.utc).isoformat()
    try:
        dt = parsedate_to_datetime(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return datetime.now(timezone.utc).isoformat()


def _sentiment_payload(title: str, summary: str) -> dict[str, Any]:
    return score_article_sentiment(_compose_news_text(title, summary))


def _rss_item_to_payload(item: ET.Element) -> dict[str, Any] | None:
    title = (item.findtext("title") or "").strip()
    url = (item.findtext("link") or "").strip()
    summary = _strip_html((item.findtext("description") or "").strip())
    source = (item.findtext("source") or "").strip() or "Google News"
    published_at = _to_iso_from_rss_date(item.findtext("pubDate"))
    if not title or not url:
        return None
    sentiment = _sentiment_payload(title, summary)
    return {
        "id": _stable_id(url, title, published_at),
        "source": source,
        "title": title,
        "url": url,
        "summary": summary,
        "image_url": "",
        "published_at": published_at,
        "tickers": [],
        "sentiment": sentiment,
    }


async def _fetch_google_news_rss(query: str, limit: int = 50) -> list[dict[str, Any]]:
    q = (query or "").strip()
    if not q:
        return []
    url = "https://news.google.com/rss/search"
    params = {
        "q": q,
        "hl": "en-US",
        "gl": "US",
        "ceid": "US:en",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0, trust_env=False, follow_redirects=True) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
    except Exception:
        return []

    out: list[dict[str, Any]] = []
    for node in root.findall(".//item"):
        parsed = _rss_item_to_payload(node)
        if parsed:
            out.append(parsed)
        if len(out) >= limit:
            break
    return out


def _yahoo_news_row_to_payload(row: dict[str, Any]) -> dict[str, Any] | None:
    title = str(row.get("title") or "").strip()
    url = str(row.get("link") or row.get("url") or "").strip()
    summary = _strip_html(str(row.get("summary") or row.get("description") or "").strip())
    source = str(row.get("publisher") or row.get("source") or "Yahoo Finance").strip() or "Yahoo Finance"
    published_at = _to_iso_from_epoch(row.get("providerPublishTime")) or _to_iso_from_rss_date(str(row.get("pubDate") or ""))
    if not title or not url:
        return None
    sentiment = _sentiment_payload(title, summary)
    return {
        "id": _stable_id(url, title, published_at),
        "source": source,
        "title": title,
        "url": url,
        "summary": summary,
        "image_url": "",
        "published_at": published_at,
        "tickers": [],
        "sentiment": sentiment,
    }


async def _fetch_yahoo_news(query: str, limit: int = 50) -> list[dict[str, Any]]:
    fetcher = await get_unified_fetcher()
    rows = await fetcher.search_news(query, limit=limit)
    out: list[dict[str, Any]] = []
    for row in rows:
        parsed = _yahoo_news_row_to_payload(row)
        if parsed:
            out.append(parsed)
        if len(out) >= limit:
            break
    return out


async def _fetch_news_fallback(query: str, limit: int = 50) -> list[dict[str, Any]]:
    from backend.services.news_cascade import get_news_cascade

    fetcher = await get_unified_fetcher()
    cascade = get_news_cascade()
    result = await cascade.fetch_query_news(fetcher, query, limit=limit)
    return result.items[:limit]


async def _fallback_latest_news(limit: int = 50) -> list[dict[str, Any]]:
    from backend.services.news_cascade import get_news_cascade

    fetcher = await get_unified_fetcher()
    cascade = get_news_cascade()
    result = await cascade.fetch_broad_us_news(fetcher, limit=limit)
    return result.items[:limit]


def _list_payload(items: list[dict[str, Any]], *, meta: dict[str, Any] | None = None) -> dict[str, Any]:
    """Canonical list contract: both `items` and `results` for callers."""
    payload: dict[str, Any] = {"items": items, "results": items}
    if meta:
        payload["meta"] = meta
    return payload


@router.get("/news/symbol")
async def get_symbol_news(
    market: str = Query(..., description="NYSE|NASDAQ|US"),
    symbol: str = Query(..., min_length=1, max_length=24),
    limit: int = Query(default=30, ge=1, le=100),
) -> dict[str, Any]:
    from backend.services.news_cascade import get_news_cascade

    _validate_market(market)
    ticker = symbol.strip().upper()
    fetcher = await get_unified_fetcher()
    cascade = get_news_cascade()
    result = await cascade.fetch_symbol_news(fetcher, ticker, limit=limit)
    items = result.items[:limit]
    if not items:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "news_unavailable",
                "message": f"No U.S. news available for {ticker}",
                "providers_tried": result.providers_tried,
                "errors": result.errors,
            },
        )
    return _list_payload(
        items,
        meta={
            "provider": result.winning_provider,
            "fallback_used": result.fallback_used,
            "providers_tried": result.providers_tried,
        },
    )


@router.get("/news/market")
async def get_market_news(
    market: str = Query(..., description="NYSE|NASDAQ|US"),
    limit: int = Query(default=30, ge=1, le=100),
) -> dict[str, Any]:
    from backend.services.news_cascade import get_news_cascade

    _validate_market(market)
    fetcher = await get_unified_fetcher()
    cascade = get_news_cascade()
    result = await cascade.fetch_market_news(fetcher, limit=limit)
    items = result.items[:limit]
    if not items:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "news_unavailable",
                "message": "No U.S. market news available from configured providers",
                "providers_tried": result.providers_tried,
                "errors": result.errors,
            },
        )
    return _list_payload(
        items,
        meta={
            "provider": result.winning_provider,
            "fallback_used": result.fallback_used,
            "providers_tried": result.providers_tried,
        },
    )



@router.get("/news/latest")
async def get_latest_news(limit: int = Query(default=50, ge=1, le=200)) -> dict[str, Any]:
    cache_key = cache_instance.build_key("news_latest", "all", {"limit": limit})
    cached = await cache_instance.get(cache_key)
    if cached:
        return cached

    db = SessionLocal()
    try:
        rows = db.query(NewsArticle).order_by(desc(NewsArticle.published_at)).limit(limit).all()
        items = [_row_to_item(row) for row in rows]
        if not items:
            items = await _fallback_latest_news(limit=limit)
        payload = _list_payload(items)
    except OperationalError:
        payload = _list_payload(await _fallback_latest_news(limit=limit))
    finally:
        db.close()

    await cache_instance.set(
        cache_key,
        payload,
        ttl=ttl_seconds("news_latest", market_open_now()),
    )
    return payload


@router.get("/news/search")
async def search_news(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    term = q.strip()
    cache_key = cache_instance.build_key("news_latest", "search", {"q": term.lower(), "limit": limit})
    cached = await cache_instance.get(cache_key)
    if cached:
        return cached

    db = SessionLocal()
    try:
        like = f"%{term}%"
        rows = (
            db.query(NewsArticle)
            .filter(
                or_(
                    NewsArticle.title.ilike(like),
                    NewsArticle.summary.ilike(like),
                    NewsArticle.source.ilike(like),
                )
            )
            .order_by(desc(NewsArticle.published_at))
            .limit(limit)
            .all()
        )
        items = [_row_to_item(row) for row in rows]
        if not items:
            items = await _fetch_news_fallback(term, limit=limit)
        if not items:
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "news_unavailable",
                    "message": f"No news results for query",
                },
            )
        payload = _list_payload(items)
    except HTTPException:
        raise
    except OperationalError:
        items = await _fetch_news_fallback(term, limit=limit)
        if not items:
            raise HTTPException(
                status_code=503,
                detail={"code": "news_unavailable", "message": "No news results for query"},
            )
        payload = _list_payload(items)
    finally:
        db.close()

    await cache_instance.set(
        cache_key,
        payload,
        ttl=ttl_seconds("news_latest", market_open_now()),
    )
    return payload


# Known company names for relevance matching on fallback searches.
# Add entries as needed — generic fallback avoids false positives.
TICKER_COMPANY_NAMES: dict[str, list[str]] = {
    "NVDA": ["nvidia", "nvidia corporation"],
    "AAPL": ["apple", "apple inc"],
    "MSFT": ["microsoft", "microsoft corporation"],
    "GOOGL": ["alphabet", "google"],
    "GOOG": ["alphabet", "google"],
    "AMZN": ["amazon", "amazon.com"],
    "META": ["meta", "facebook"],
    "TSLA": ["tesla", "tesla inc"],
    "SPY": ["spdr s&p 500", "spy"],
    "QQQ": ["invesco qqq", "qqq"],
}


def _is_relevant_for_ticker(
    title: str,
    summary: str,
    symbol: str,
) -> bool:
    """Check whether an article's title or summary actually mentions the ticker.

    Returns True if the symbol, company name, or an approved alias appears
    as a whole word in the title or summary.  Case-insensitive.
    """
    text = f"{title or ''} {summary or ''}".lower()
    sym_lower = symbol.lower()

    # 1. Whole-word ticker symbol match (e.g. "NVDA", not "NVD").
    if re.search(rf"(?<![a-z]){re.escape(sym_lower)}(?![a-z])", text):
        return True

    # 2. Company / product name match.
    names = TICKER_COMPANY_NAMES.get(symbol.upper(), [])
    for name in names:
        if name.lower() in text:
            return True

    return False


def _tag_matched_ticker(
    item: dict[str, Any],
    symbol: str,
    matched: bool,
) -> dict[str, Any]:
    """Attach match metadata to a news item."""
    item = {**item}
    if matched:
        item["matched_symbols"] = [symbol.upper()]
        item["match_reason"] = "symbol_or_name_match"
    else:
        item["matched_symbols"] = []
        item["match_reason"] = "market_fallback"
        # Clear ticker-level sentiment for unmatched fallback articles.
        if "sentiment" in item:
            item["sentiment"] = {"score": 0.0, "label": "Neutral", "confidence": 0.0}
    return item

@router.get("/news/by-ticker/{ticker}")
async def get_news_by_ticker(
    ticker: str,
    limit: int = Query(default=50, ge=1, le=200),
    market: str | None = Query(default=None, description="Optional market context e.g. NYSE/NASDAQ/US"),
) -> dict[str, Any]:
    from backend.services.news_cascade import get_news_cascade

    symbol = ticker.strip().upper()
    if not isinstance(market, str):
        market = None
    market_code = (market or "").strip().upper() or None
    if market_code in {"NSE", "BSE", "IN", "INDIA"}:
        raise HTTPException(status_code=400, detail="India markets are not supported. Use NYSE or NASDAQ.")
    cache_key = cache_instance.build_key("news_latest", f"ticker:{symbol}", {"limit": limit, "market": market_code or ""})
    cached = await cache_instance.get(cache_key)
    if cached:
        return cached

    db = SessionLocal()
    try:
        aliases = _ticker_aliases(symbol, market_code)
        ticker_filters = [NewsArticle.tickers.like(f'%"{alias}"%') for alias in aliases]
        rows = (
            db.query(NewsArticle)
            .filter(or_(*ticker_filters))
            .order_by(desc(NewsArticle.published_at))
            .limit(limit)
            .all()
        )
        items = [_row_to_item(row) for row in rows]
        if not items:
            fetcher = await get_unified_fetcher()
            cascade = get_news_cascade()
            result = await cascade.fetch_symbol_news(fetcher, symbol, limit=limit)
            items = [
                _tag_matched_ticker(
                    item,
                    symbol,
                    _is_relevant_for_ticker(str(item.get("title") or ""), str(item.get("summary") or ""), symbol),
                )
                for item in result.items
            ]
        payload = _list_payload(items)
    except OperationalError:
        fetcher = await get_unified_fetcher()
        cascade = get_news_cascade()
        result = await cascade.fetch_symbol_news(fetcher, symbol, limit=limit)
        fallback_items = [
            _tag_matched_ticker(
                item,
                symbol,
                _is_relevant_for_ticker(str(item.get("title") or ""), str(item.get("summary") or ""), symbol),
            )
            for item in result.items
        ]
        payload = _list_payload(fallback_items)
    finally:
        db.close()

    await cache_instance.set(
        cache_key,
        payload,
        ttl=ttl_seconds("news_latest", market_open_now()),
    )
    return payload


@router.get("/news/sentiment/market")
async def get_market_sentiment(
    days: int = Query(default=7, ge=1, le=30),
    market: str | None = Query(default=None, description="Optional market context e.g. NYSE/NASDAQ/US"),
) -> dict[str, Any]:
    market_code = (market or "").strip().upper()
    if market_code in {"NSE", "BSE", "IN", "INDIA"}:
        raise HTTPException(status_code=400, detail="India markets are not supported. Use NYSE or NASDAQ.")
    cache_key = cache_instance.build_key("news_latest", "sentiment:market", {"days": days, "market": market_code})
    cached = await cache_instance.get(cache_key)
    if cached:
        return cached

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_iso = cutoff.isoformat()

    db = SessionLocal()
    try:
        rows = (
            db.query(NewsArticle)
            .filter(NewsArticle.published_at >= cutoff_iso)
            .order_by(desc(NewsArticle.published_at))
            .limit(800)
            .all()
        )
    except OperationalError:
        rows = []
    finally:
        db.close()

    ticker_set: set[str] = set()
    row_tickers: list[list[str]] = []
    for row in rows:
        tickers: list[str] = []
        try:
            parsed = json.loads(row.tickers or "[]")
            if isinstance(parsed, list):
                tickers = [str(v).split(".")[0].strip().upper() for v in parsed if str(v).strip()]
        except Exception:
            tickers = []
        row_tickers.append(tickers)
        ticker_set.update(tickers[:4])

    ticker_to_sector: dict[str, str] = {}
    if ticker_set:
        sem = asyncio.Semaphore(12)

        async def _fetch_sector(sym: str) -> tuple[str, str]:
            async with sem:
                snap = await fetch_stock_snapshot_coalesced(sym)
                sector = str((snap or {}).get("sector") or "Unknown").strip() or "Unknown"
                return sym, sector

        resolved = await asyncio.gather(*[_fetch_sector(sym) for sym in list(ticker_set)[:200]])
        ticker_to_sector = {sym: sector for sym, sector in resolved}

    agg: dict[str, dict[str, Any]] = {}
    for idx, row in enumerate(rows):
        sentiment = _row_sentiment(row)
        score = float(sentiment.get("score", 0.0))
        label = str(sentiment.get("label") or _label_from_score(score))
        tickers = row_tickers[idx]
        sector = "Unknown"
        for t in tickers:
            s = ticker_to_sector.get(t)
            if s:
                sector = s
                break
        node = agg.setdefault(
            sector,
            {
                "sector": sector,
                "articles_count": 0,
                "avg_sentiment": 0.0,
                "bullish_count": 0,
                "bearish_count": 0,
                "neutral_count": 0,
                "sum_score": 0.0,
            },
        )
        node["articles_count"] += 1
        node["sum_score"] += score
        if label == "Bullish":
            node["bullish_count"] += 1
        elif label == "Bearish":
            node["bearish_count"] += 1
        else:
            node["neutral_count"] += 1

    sectors = []
    for row in agg.values():
        count = int(row["articles_count"]) or 1
        avg = float(row["sum_score"]) / count
        sectors.append(
            {
                "sector": row["sector"],
                "articles_count": int(row["articles_count"]),
                "avg_sentiment": round(avg, 4),
                "bullish_count": int(row["bullish_count"]),
                "bearish_count": int(row["bearish_count"]),
                "neutral_count": int(row["neutral_count"]),
            }
        )
    sectors.sort(key=lambda x: x["articles_count"], reverse=True)

    payload = {
        "period_days": days,
        "market": market_code or "ALL",
        "sectors": sectors,
    }
    await cache_instance.set(
        cache_key,
        payload,
        ttl=ttl_seconds("news_latest", market_open_now()),
    )
    return payload


@router.get("/news/sentiment/summary")
async def get_news_sentiment_summary(
    days: int = Query(default=7, ge=1, le=30),
    limit: int = Query(default=200, ge=20, le=1000),
) -> dict[str, Any]:
    cache_key = cache_instance.build_key("news_latest", "sentiment:summary", {"days": days, "limit": limit})
    cached = await cache_instance.get(cache_key)
    if cached:
        return cached

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_iso = cutoff.isoformat()

    db = SessionLocal()
    try:
        rows = (
            db.query(NewsArticle)
            .filter(NewsArticle.published_at >= cutoff_iso)
            .order_by(desc(NewsArticle.published_at))
            .limit(limit)
            .all()
        )
    except OperationalError:
        rows = []
    finally:
        db.close()

    if not rows:
        fallback_items = await _fallback_latest_news(limit=min(200, limit))
        labels = {"Bullish": 0, "Bearish": 0, "Neutral": 0}
        scores: list[float] = []
        for item in fallback_items:
            sent = item.get("sentiment") if isinstance(item, dict) else {}
            score = float((sent or {}).get("score", 0.0))
            label = str((sent or {}).get("label") or _label_from_score(score))
            if label not in labels:
                label = _label_from_score(score)
            labels[label] += 1
            scores.append(score)
        total = len(scores)
        avg = (sum(scores) / total) if total else 0.0
        payload = {
            "period_days": days,
            "total_articles": total,
            "average_score": round(avg, 4),
            "overall_label": _label_from_score(avg),
            "distribution": {
                "bullish_pct": round((labels["Bullish"] * 100.0 / total), 1) if total else 0.0,
                "bearish_pct": round((labels["Bearish"] * 100.0 / total), 1) if total else 0.0,
                "neutral_pct": round((labels["Neutral"] * 100.0 / total), 1) if total else 0.0,
            },
            "top_sources": [],
        }
        await cache_instance.set(cache_key, payload, ttl=ttl_seconds("news_latest", market_open_now()))
        return payload

    source_counts: dict[str, int] = defaultdict(int)
    labels = {"Bullish": 0, "Bearish": 0, "Neutral": 0}
    scores: list[float] = []
    for row in rows:
        source_counts[str(row.source or "Unknown").strip() or "Unknown"] += 1
        sentiment = _row_sentiment(row)
        score = float(sentiment.get("score", 0.0))
        label = str(sentiment.get("label") or _label_from_score(score))
        if label not in labels:
            label = _label_from_score(score)
        labels[label] += 1
        scores.append(score)

    total = len(scores)
    avg = (sum(scores) / total) if total else 0.0
    top_sources = [{"source": src, "count": count} for src, count in sorted(source_counts.items(), key=lambda kv: kv[1], reverse=True)[:10]]
    payload = {
        "period_days": days,
        "total_articles": total,
        "average_score": round(avg, 4),
        "overall_label": _label_from_score(avg),
        "distribution": {
            "bullish_pct": round((labels["Bullish"] * 100.0 / total), 1) if total else 0.0,
            "bearish_pct": round((labels["Bearish"] * 100.0 / total), 1) if total else 0.0,
            "neutral_pct": round((labels["Neutral"] * 100.0 / total), 1) if total else 0.0,
        },
        "top_sources": top_sources,
    }
    await cache_instance.set(cache_key, payload, ttl=ttl_seconds("news_latest", market_open_now()))
    return payload

@router.get("/news/sentiment/{ticker}")
async def get_news_sentiment(
    ticker: str,
    days: int = Query(default=7, ge=1, le=30),
    market: str | None = Query(default=None, description="Optional market context e.g. NYSE/NASDAQ/US"),
) -> dict[str, Any]:
    if not isinstance(market, str):
        market = None
    symbol = ticker.strip().upper()
    market_code = (market or "").strip().upper() or None
    if market_code in {"NSE", "BSE", "IN", "INDIA"}:
        raise HTTPException(status_code=400, detail="India markets are not supported. Use NYSE or NASDAQ.")
    cache_key = cache_instance.build_key("news_latest", f"sentiment:{symbol}", {"days": days, "market": market_code or ""})
    cached = await cache_instance.get(cache_key)
    if cached:
        return cached

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_iso = cutoff.isoformat()

    db = SessionLocal()
    try:
        aliases = _ticker_aliases(symbol, market_code)
        ticker_filters = [NewsArticle.tickers.like(f'%"{alias}"%') for alias in aliases]
        rows = (
            db.query(NewsArticle)
            .filter(or_(*ticker_filters), NewsArticle.published_at >= cutoff_iso)
            .order_by(desc(NewsArticle.published_at))
            .all()
        )
    except OperationalError:
        rows = []
    finally:
        db.close()

    bullish = 0
    bearish = 0
    neutral = 0
    sum_score = 0.0
    day_buckets: dict[str, list[float]] = defaultdict(list)

    if rows:
        total = len(rows)
        for row in rows:
            sentiment = _row_sentiment(row)
            score = float(sentiment.get("score", 0.0))
            label = str(sentiment.get("label") or _label_from_score(score))
            if label == "Bullish":
                bullish += 1
            elif label == "Bearish":
                bearish += 1
            else:
                neutral += 1
            sum_score += score

            day = _to_day(row.published_at)
            if day:
                day_buckets[day].append(score)
    else:
        # Fallback sentiment when DB has no ingested records.
        fallback_items: list[dict[str, Any]] = []
        for term in _ticker_fallback_terms(symbol, market_code):
            fallback_items = await _fetch_news_fallback(term, limit=max(20, days * 8))
            if fallback_items:
                break
        total = len(fallback_items)
        for item in fallback_items:
            sent = item.get("sentiment") if isinstance(item, dict) else {}
            score = float((sent or {}).get("score", 0.0))
            label = str((sent or {}).get("label") or _label_from_score(score))
            if label == "Bullish":
                bullish += 1
            elif label == "Bearish":
                bearish += 1
            else:
                neutral += 1
            sum_score += score
            day = _to_day(str(item.get("published_at") or ""))
            if day:
                day_buckets[day].append(score)

    avg_score = (sum_score / total) if total else 0.0
    daily_sentiment = [
        {
            "date": d,
            "avg_score": round(sum(vals) / len(vals), 4),
            "count": len(vals),
        }
        for d, vals in sorted(day_buckets.items())
    ]

    payload = {
        "ticker": symbol,
        "period_days": days,
        "total_articles": total,
        "average_score": round(avg_score, 4),
        "bullish_pct": round((bullish * 100.0 / total), 1) if total else 0.0,
        "bearish_pct": round((bearish * 100.0 / total), 1) if total else 0.0,
        "neutral_pct": round((neutral * 100.0 / total), 1) if total else 0.0,
        "overall_label": _label_from_score(avg_score),
        "daily_sentiment": daily_sentiment,
    }
    await cache_instance.set(
        cache_key,
        payload,
        ttl=ttl_seconds("news_latest", market_open_now()),
    )
    return payload



# ---------------------------------------------------------------------------
# Legacy /api/v1/* aliases (auth-exempt prefix). Keep payloads identical to the
# canonical /api/news/* and /api/news/sentiment/* handlers.
# ---------------------------------------------------------------------------


@router.get("/v1/news/latest")
async def v1_get_latest_news(limit: int = Query(default=50, ge=1, le=200)) -> dict[str, Any]:
    return await get_latest_news(limit=limit)


@router.get("/v1/news/search")
async def v1_search_news(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    return await search_news(q=q, limit=limit)


@router.get("/v1/news/ticker/{ticker}")
async def v1_get_news_by_ticker(
    ticker: str,
    limit: int = Query(default=50, ge=1, le=200),
    market: str | None = Query(default=None),
) -> dict[str, Any]:
    return await get_news_by_ticker(ticker=ticker, limit=limit, market=market)


@router.get("/v1/sentiment/market")
async def v1_get_market_sentiment(
    days: int = Query(default=7, ge=1, le=30),
    market: str | None = Query(default=None),
) -> dict[str, Any]:
    return await get_market_sentiment(days=days, market=market)


@router.get("/v1/sentiment/summary")
async def v1_get_news_sentiment_summary(
    days: int = Query(default=7, ge=1, le=30),
    limit: int = Query(default=200, ge=20, le=1000),
) -> dict[str, Any]:
    return await get_news_sentiment_summary(days=days, limit=limit)


@router.get("/v1/sentiment/ticker/{ticker}")
async def v1_get_news_sentiment(
    ticker: str,
    days: int = Query(default=7, ge=1, le=30),
    market: str | None = Query(default=None),
) -> dict[str, Any]:
    return await get_news_sentiment(ticker=ticker, days=days, market=market)
