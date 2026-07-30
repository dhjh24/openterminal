from __future__ import annotations

import asyncio
import logging
import os
from typing import List

from backend.core.unified_fetcher import UnifiedFetcher
from backend.db.models import Holding, WatchlistItem
from backend.shared.cache import cache
from backend.shared.db import SessionLocal
from backend.shared.market_calendar import equity_market_open_now
from backend.shared.market_profile import DEFAULT_PREFETCH_SYMBOLS

logger = logging.getLogger(__name__)


def is_market_hours() -> bool:
    """True during the U.S. equity regular session (America/New_York).

    Uses ZoneInfo for DST — never a fixed UTC offset. Delegates to the
    shared NYSE calendar (weekends, holidays, early closes).
    """
    return equity_market_open_now()


def get_prefetch_symbols() -> list[str]:
    """Configurable U.S. prefetch universe.

    Override with comma-separated ``PREFETCH_SYMBOLS`` / ``OPENTERMINALUI_PREFETCH_SYMBOLS``.
    Defaults: SPY, QQQ, IWM, DIA, AAPL, MSFT, NVDA, AMZN, META, TSLA.
    """
    raw = (
        os.getenv("PREFETCH_SYMBOLS")
        or os.getenv("OPENTERMINALUI_PREFETCH_SYMBOLS")
        or ""
    ).strip()
    if raw:
        symbols = [s.strip().upper() for s in raw.split(",") if s.strip()]
        if symbols:
            return symbols
    return list(DEFAULT_PREFETCH_SYMBOLS)


def get_db_tickers() -> List[str]:
    db = SessionLocal()
    try:
        holdings = [h.ticker for h in db.query(Holding.ticker).all()]
        watchlist = [w.ticker for w in db.query(WatchlistItem.ticker).all()]
        return list(set(holdings + watchlist))
    except Exception as e:
        logger.error("Error fetching DB tickers: %s", e)
        return []
    finally:
        db.close()


class PrefetchWorker:
    def __init__(self, fetcher: UnifiedFetcher, interval: int = 900):
        self.fetcher = fetcher
        self.interval = interval
        self._task = None
        self._stop_event = asyncio.Event()

    async def start(self):
        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._loop())
        logger.info("event=prefetch_worker_started interval_seconds=%s", self.interval)

    async def stop(self):
        if self._task:
            self._stop_event.set()
            await self._task
            self._task = None
            logger.info("event=prefetch_worker_stopped")

    async def _loop(self):
        while not self._stop_event.is_set():
            if is_market_hours():
                logger.info("event=prefetch_cycle_start market_open=true")
                await self._prefetch()
            else:
                logger.debug("event=prefetch_cycle_skip market_open=false")

            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.interval)
            except asyncio.TimeoutError:
                continue

    async def _prefetch(self):
        targets = set(get_prefetch_symbols())
        targets.update(get_db_tickers())
        ticker_list = list(targets)

        logger.info("event=prefetch_symbols count=%s", len(ticker_list))

        sem = asyncio.Semaphore(10)

        async def work(ticker: str) -> None:
            async with sem:
                try:
                    data = await self.fetcher.fetch_stock_snapshot(ticker)
                    if data:
                        key = cache.build_key("snapshot", ticker)
                        await cache.set(key, data, ttl=300)
                except Exception as e:
                    logger.error("Prefetch failed for %s: %s", ticker, e)

        await asyncio.gather(*(work(t) for t in ticker_list))
        logger.info("event=prefetch_cycle_complete symbols=%s", len(ticker_list))


_worker_instance = None


def get_prefetch_worker(fetcher: UnifiedFetcher) -> PrefetchWorker:
    global _worker_instance
    if _worker_instance is None:
        _worker_instance = PrefetchWorker(fetcher)
    return _worker_instance
