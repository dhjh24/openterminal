"""Structured HTTP 400 for India / unsupported market inputs across public routes."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _us_profile(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MARKET_PROFILE", "US")
    monkeypatch.delenv("OPENTERMINALUI_MARKET_PROFILE", raising=False)


def _assert_unsupported_400(resp) -> dict:
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert isinstance(detail, dict)
    assert detail.get("code") == "unsupported_market" or detail.get("error") == "unsupported_market"
    assert "message" in detail
    assert "input" in detail or "exchange" in detail
    assert "allowed_markets" in detail or "supported_exchanges" in detail
    allowed = detail.get("allowed_markets") or detail.get("supported_exchanges")
    assert "NYSE" in allowed and "NASDAQ" in allowed
    assert "NSE" not in allowed
    return detail


def test_quotes_rejects_nse_market() -> None:
    from backend.api.routes.quotes import router

    app = FastAPI()
    app.include_router(router, prefix="/api")
    client = TestClient(app)
    resp = client.get("/api/quotes", params={"market": "NSE", "symbols": "RELIANCE"})
    _assert_unsupported_400(resp)


def test_quotes_rejects_ns_suffix() -> None:
    from backend.api.routes.quotes import router

    app = FastAPI()
    app.include_router(router, prefix="/api")
    client = TestClient(app)
    resp = client.get("/api/quotes", params={"market": "NASDAQ", "symbols": "RELIANCE.NS"})
    _assert_unsupported_400(resp)


def test_search_rejects_nse_market() -> None:
    from backend.api.routes.search import router

    app = FastAPI()
    app.include_router(router, prefix="/api")
    client = TestClient(app)
    resp = client.get("/api/search", params={"q": "AAPL", "market": "NSE"})
    _assert_unsupported_400(resp)


def test_screener_scan_rejects_india_market() -> None:
    from backend.api.routes.screener import router

    app = FastAPI()
    app.include_router(router, prefix="/api")
    client = TestClient(app)
    resp = client.post(
        "/api/screener/scan",
        json={"markets": ["NSE"], "filters": [], "limit": 10},
    )
    _assert_unsupported_400(resp)


def test_heatmap_rejects_india() -> None:
    from backend.api.routes.heatmap import router

    app = FastAPI()
    app.include_router(router, prefix="/api")
    client = TestClient(app)
    resp = client.get("/api/treemap", params={"market": "IN"})
    _assert_unsupported_400(resp)


def test_option_chain_nifty_returns_400_not_200_error_object() -> None:
    from backend.fno.routes.option_chain import router

    app = FastAPI()
    app.include_router(router, prefix="/api")
    client = TestClient(app)
    resp = client.get("/api/fno/chain/NIFTY")
    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"]
    assert isinstance(detail, dict)
    assert detail.get("code") == "unsupported_market" or detail.get("error") == "unsupported_market"
    # Must not be a 200 chain payload with embedded error
    assert "strikes" not in (resp.json() if isinstance(resp.json(), dict) else {})


def test_option_chain_ns_suffix_rejected() -> None:
    from backend.fno.routes.option_chain import router

    app = FastAPI()
    app.include_router(router, prefix="/api")
    client = TestClient(app)
    resp = client.get("/api/fno/chain/RELIANCE.NS")
    _assert_unsupported_400(resp)


def test_market_profile_rejects_multi(monkeypatch) -> None:
    from backend.shared.market_profile import MarketProfileError, get_market_profile

    monkeypatch.setenv("MARKET_PROFILE", "MULTI")
    with pytest.raises(MarketProfileError):
        get_market_profile()


def test_market_profile_rejects_india(monkeypatch) -> None:
    from backend.shared.market_profile import MarketProfileError, get_market_profile

    for value in ("IN", "INDIA", "ALL"):
        monkeypatch.setenv("MARKET_PROFILE", value)
        with pytest.raises(MarketProfileError):
            get_market_profile()


def test_ws_symbol_token_rejects_nse_prefix() -> None:
    """MarketDataHub only accepts NYSE|NASDAQ tokens."""
    from backend.services.marketdata_hub import SYMBOL_TOKEN_RE

    assert SYMBOL_TOKEN_RE.match("NASDAQ:AAPL")
    assert SYMBOL_TOKEN_RE.match("NYSE:IBM")
    assert SYMBOL_TOKEN_RE.match("NSE:RELIANCE") is None
    assert SYMBOL_TOKEN_RE.match("AMEX:SPY") is None
