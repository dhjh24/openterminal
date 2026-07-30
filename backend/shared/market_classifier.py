"""U.S. symbol classification (exchange, currency, session status).

Under MARKET_PROFILE=US this module never rewrites ``.NS`` / ``.BO`` symbols into
U.S. tickers — callers must reject those inputs via ``market_guard`` first.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from pydantic import BaseModel
from zoneinfo import ZoneInfo

from backend.shared.market_calendar import is_extended_hours, is_market_open
from backend.shared.market_profile import (
    DEFAULT_EXCHANGE,
    US_SUPPORTED_EXCHANGES,
    has_india_suffix,
    is_us_only,
)


class StockClassification(BaseModel):
    symbol: str
    display_name: str
    exchange: str
    country_code: str
    country_name: str
    flag_emoji: str
    currency: str
    has_futures: bool
    has_options: bool
    market_status: str


EXCHANGE_COUNTRY_MAP = {
    "NYSE": {"country_code": "US", "country_name": "United States", "flag_emoji": "🇺🇸", "currency": "USD"},
    "NASDAQ": {"country_code": "US", "country_name": "United States", "flag_emoji": "🇺🇸", "currency": "USD"},
}

_US_EXCHANGES = set(US_SUPPORTED_EXCHANGES)
ET = ZoneInfo("America/New_York")


def _country_flag_emoji(country_code: str) -> str:
    code = (country_code or "").strip().upper()
    if len(code) != 2 or not code.isalpha():
        return ""
    return chr(0x1F1E6 + ord(code[0]) - ord("A")) + chr(0x1F1E6 + ord(code[1]) - ord("A"))


def _market_status_for_exchange(exchange: str) -> str:
    ex = (exchange or "").strip().upper()
    if ex not in _US_EXCHANGES:
        ex = DEFAULT_EXCHANGE
    now = datetime.now(ET)
    if now.weekday() >= 5:
        return "closed"
    try:
        if is_market_open(ex, now):
            return "open"
        if is_extended_hours(ex, now):
            # Distinguish pre vs post by clock
            t = now.time()
            if t.hour < 12:
                return "pre-market"
            return "post-market"
        return "closed"
    except ValueError:
        return "closed"


class MarketClassifier:
    _cache_ttl = timedelta(days=7)

    def __init__(self) -> None:
        self._cache: dict[str, tuple[datetime, StockClassification]] = {}
        self._cache_lock = asyncio.Lock()
        self._http = httpx.AsyncClient(timeout=12.0, trust_env=False, follow_redirects=True)
        self._fmp_key = os.getenv("FMP_API_KEY", "").strip()

    async def close(self) -> None:
        await self._http.aclose()

    async def _fetch_fmp_profile(self, symbol: str) -> dict[str, Any]:
        if not self._fmp_key:
            return {}
        try:
            resp = await self._http.get(
                "https://financialmodelingprep.com/stable/profile",
                params={"symbol": symbol, "apikey": self._fmp_key},
            )
            resp.raise_for_status()
            payload = resp.json()
            if isinstance(payload, list) and payload:
                first = payload[0]
                if isinstance(first, dict):
                    return first
        except Exception:
            return {}
        return {}

    def _country_meta_from_profile(self, profile: dict[str, Any]) -> dict[str, str]:
        country_raw = str(profile.get("country") or "").strip()
        if len(country_raw) == 2:
            code = country_raw.upper()
            return {
                "country_code": code,
                "country_name": code,
                "flag_emoji": _country_flag_emoji(code),
                "currency": str(profile.get("currency") or "USD"),
            }
        low = country_raw.lower()
        if low in {"united states", "usa", "us"}:
            return {
                "country_code": "US",
                "country_name": "United States",
                "flag_emoji": "🇺🇸",
                "currency": str(profile.get("currency") or "USD"),
            }
        return {
            "country_code": "US",
            "country_name": "United States",
            "flag_emoji": "🇺🇸",
            "currency": str(profile.get("currency") or "USD"),
        }

    async def classify(self, symbol: str) -> StockClassification:
        input_symbol = symbol.strip().upper()
        now = datetime.now(timezone.utc)
        async with self._cache_lock:
            cached = self._cache.get(input_symbol)
            if cached and cached[0] > now:
                return cached[1]

        # Never strip .NS/.BO and reinterpret as U.S. — leave suffix intact so
        # upstream guards can reject; classify as unsupported India exchange.
        if has_india_suffix(input_symbol):
            classified = StockClassification(
                symbol=input_symbol,
                display_name=input_symbol,
                exchange="NSE" if input_symbol.endswith(".NS") else "BSE",
                country_code="IN",
                country_name="India",
                flag_emoji="🇮🇳",
                currency="INR",
                has_futures=False,
                has_options=False,
                market_status="closed",
            )
            async with self._cache_lock:
                self._cache[input_symbol] = (now + self._cache_ttl, classified)
            return classified

        base_symbol = input_symbol
        profile = await self._fetch_fmp_profile(input_symbol)
        exchange = str(profile.get("exchangeShortName") or profile.get("exchange") or "").strip().upper()
        if exchange in {"NSE", "BSE", "NFO", "AMEX", "CBOE", "CME"}:
            # Unsupported under first-release US profile → default listing venue.
            exchange = DEFAULT_EXCHANGE
        if exchange not in _US_EXCHANGES:
            exchange = DEFAULT_EXCHANGE

        ex_meta = EXCHANGE_COUNTRY_MAP.get(exchange) or self._country_meta_from_profile(profile)
        display_name = str(
            profile.get("companyName") or profile.get("name") or base_symbol
        ).strip() or base_symbol

        classified = StockClassification(
            symbol=base_symbol,
            display_name=display_name,
            exchange=exchange,
            country_code="US",
            country_name="United States",
            flag_emoji="🇺🇸",
            currency=str(profile.get("currency") or "USD"),
            has_futures=False,
            has_options=True,
            market_status=_market_status_for_exchange(exchange),
        )

        async with self._cache_lock:
            self._cache[input_symbol] = (now + self._cache_ttl, classified)
        return classified

    async def yfinance_symbol(self, symbol: str) -> str:
        raw = symbol.strip().upper()
        if raw.startswith("^") or "=" in raw:
            return raw
        # Do not strip India suffixes — callers must reject those symbols.
        if has_india_suffix(raw):
            return raw
        return raw


market_classifier = MarketClassifier()
