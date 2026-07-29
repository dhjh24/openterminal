"""F&O instruments loader removed under MARKET_PROFILE=US (was Kite/NFO-only)."""

from __future__ import annotations


class InstrumentsLoader:
    """No-op stub retained for import compatibility."""

    async def start(self) -> None:
        return None

    async def stop(self) -> None:
        return None


_instruments_loader = InstrumentsLoader()


def get_instruments_loader() -> InstrumentsLoader:
    return _instruments_loader
