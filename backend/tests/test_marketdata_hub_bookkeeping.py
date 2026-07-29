from __future__ import annotations

import asyncio

from backend.services.marketdata_hub import MarketDataHub


class DummyWebSocket:
    pass


def test_subscribe_unsubscribe_bookkeeping() -> None:
    async def _run() -> None:
        hub = MarketDataHub()
        ws = DummyWebSocket()

        async with hub._lock:  # noqa: SLF001
            hub._connections[ws] = set()  # noqa: SLF001

        accepted = await hub.subscribe(ws, ["NASDAQ:AAPL", "NYSE:IBM", "BAD:VALUE"])
        assert accepted == ["NASDAQ:AAPL", "NYSE:IBM"]

        snap = await hub.metrics_snapshot()
        assert snap["ws_connected_clients"] == 1
        assert snap["ws_subscriptions"] == 2

        removed = await hub.unsubscribe(ws, ["NASDAQ:AAPL", "BAD:VALUE"])
        assert removed == ["NASDAQ:AAPL"]

        snap2 = await hub.metrics_snapshot()
        assert snap2["ws_connected_clients"] == 1
        assert snap2["ws_subscriptions"] == 1

    asyncio.run(_run())
