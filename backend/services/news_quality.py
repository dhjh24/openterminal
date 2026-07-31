"""News article quality controls and canonical payload shape."""

from __future__ import annotations

import hashlib
import html
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlparse

_HTML_RE = re.compile(r"<[^>]+>")
_HEADLINE_NORM_RE = re.compile(r"[^a-z0-9\s]+")
_STALE_HOURS = 72
_MAX_FUTURE_SKEW = timedelta(hours=6)


def strip_html(text: str) -> str:
    clean = _HTML_RE.sub(" ", text or "")
    clean = html.unescape(clean)
    return " ".join(clean.split()).strip()


def normalize_headline(title: str) -> str:
    text = (title or "").strip().lower()
    text = _HEADLINE_NORM_RE.sub(" ", text)
    return " ".join(text.split())


def canonical_url(url: str) -> str:
    raw = (url or "").strip()
    if not raw:
        return ""
    try:
        parsed = urlparse(raw)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return ""
        path = parsed.path.rstrip("/") or "/"
        return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}{path}"
    except Exception:
        return ""


def stable_id(url: str, title: str, published_at: str) -> str:
    key = f"{url}|{title}|{published_at}".encode("utf-8")
    return hashlib.sha1(key).hexdigest()[:16]


def to_iso_utc(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        epoch = float(value)
        if epoch <= 0:
            return None
        # Finnhub uses seconds; reject absurdly large values.
        if epoch > 1e12:
            epoch = epoch / 1000.0
        try:
            return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            return None
    text = str(value).strip()
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        pass
    try:
        dt = parsedate_to_datetime(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        return None


def freshness_label(published_at: str, *, now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    try:
        dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    except Exception:
        return "unknown"
    age = current - dt.astimezone(timezone.utc)
    if age < timedelta(0):
        return "future"
    if age <= timedelta(hours=1):
        return "fresh"
    if age <= timedelta(hours=_STALE_HOURS):
        return "recent"
    return "stale"


def is_reasonable_timestamp(published_at: str, *, now: datetime | None = None) -> bool:
    current = now or datetime.now(timezone.utc)
    try:
        dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt = dt.astimezone(timezone.utc)
    except Exception:
        return False
    if dt > current + _MAX_FUTURE_SKEW:
        return False
    if dt < current - timedelta(days=365 * 5):
        return False
    return True


def build_article(
    *,
    title: str,
    url: str,
    source: str,
    published_at: str | None,
    summary: str = "",
    image_url: str = "",
    tickers: list[str] | None = None,
    provider: str,
    sentiment: dict[str, Any] | None = None,
    fallback_used: bool = False,
) -> dict[str, Any] | None:
    clean_title = strip_html(title).strip()
    clean_url = canonical_url(url) or (url or "").strip()
    clean_source = strip_html(source).strip() or "Unknown"
    clean_summary = strip_html(summary)
    ts = to_iso_utc(published_at) or datetime.now(timezone.utc).isoformat()
    if not clean_title or not clean_url:
        return None
    if not clean_url.startswith(("http://", "https://")):
        return None
    if not is_reasonable_timestamp(ts):
        return None
    tickers_out = [str(t).strip().upper() for t in (tickers or []) if str(t).strip()]
    return {
        "id": stable_id(clean_url, clean_title, ts),
        "title": clean_title,
        "url": clean_url,
        "source": clean_source,
        "summary": clean_summary,
        "image_url": (image_url or "").strip(),
        "published_at": ts,
        "publishedAt": ts,
        "tickers": tickers_out,
        "provider": provider,
        "fallback_used": bool(fallback_used),
        "freshness": freshness_label(ts),
        "sentiment": sentiment,
    }


def dedupe_articles(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_key: dict[str, dict[str, Any]] = {}
    for item in items:
        url = canonical_url(str(item.get("url") or "")) or str(item.get("url") or "").strip()
        headline = normalize_headline(str(item.get("title") or ""))
        key = url or f"headline:{headline}"
        if not key or key == "headline:":
            continue
        existing = by_key.get(key)
        if not existing:
            by_key[key] = item
            continue
        # Merge ticker tags; keep earliest provider (higher priority in cascade order).
        existing_tickers = list(existing.get("tickers") or [])
        new_tickers = list(item.get("tickers") or [])
        merged = list(dict.fromkeys([*existing_tickers, *new_tickers]))
        existing["tickers"] = merged
    out = list(by_key.values())
    out.sort(key=lambda row: str(row.get("published_at") or ""), reverse=True)
    return out
