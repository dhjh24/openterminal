from __future__ import annotations

import asyncio
from dataclasses import dataclass

import pytest
from fastapi import HTTPException

from backend.api.routes import search


@dataclass
class _Instrument:
    symbol: str
    name: str
    exchange: str


class _Adapter:
    def __init__(self, market: str):
        self.market = market

    async def search_instruments(self, q: str):
        if self.market == "NASDAQ":
            return [_Instrument(symbol="AAPL", name="Apple Inc", exchange="NASDAQ")]
        if self.market == "NYSE":
            return [_Instrument(symbol="IBM", name="IBM", exchange="NYSE")]
        return []


class _Registry:
    def get_adapter(self, market: str):
        return _Adapter(market)


class _Cls:
    def __init__(self, exchange: str, cc: str):
        self.exchange = exchange
        self.country_code = cc
        self.flag_emoji = ""


def test_search_with_nasdaq_market_returns_us_candidates(monkeypatch) -> None:
    async def _fake_rows():
        return []

    async def _fake_classify(ticker: str):
        t = ticker.upper()
        if t in {"AAPL", "IBM"}:
            return _Cls(exchange="NASDAQ" if t == "AAPL" else "NYSE", cc="US")
        return _Cls(exchange="NASDAQ", cc="US")

    monkeypatch.setattr(search, "_get_rows", _fake_rows)
    monkeypatch.setattr(search, "get_adapter_registry", lambda: _Registry())
    monkeypatch.setattr(search.market_classifier, "classify", _fake_classify)

    out = asyncio.run(search.search(q="app", market="NASDAQ"))
    tickers = {row.ticker for row in out.results}

    assert "AAPL" in tickers


def test_search_with_nse_market_returns_unsupported_market() -> None:
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(search.search(q="app", market="NSE"))

    assert exc_info.value.status_code == 400
    detail = exc_info.value.detail
    assert detail["error"] == "unsupported_market"
    assert detail["exchange"] == "NSE"
