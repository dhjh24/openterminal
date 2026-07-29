from __future__ import annotations

import pytest

from backend.adapters.alpaca import AlpacaAdapter
from backend.adapters.registry import AdapterRegistry, get_adapter_registry
from backend.adapters.yahoo import YahooFinanceAdapter
from backend.shared.market_guard import assert_exchange_allowed


@pytest.fixture(autouse=True)
def _us_profile_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MARKET_PROFILE", "US")


def test_adapter_registry_resolves_known_exchanges() -> None:
    registry = get_adapter_registry()
    assert registry.get_adapter("NASDAQ") is not None
    assert registry.get_adapter("CRYPTO") is not None


def test_adapter_registry_rejects_nse_under_us() -> None:
    with pytest.raises(ValueError):
        get_adapter_registry().get_adapter("NSE")


def test_adapter_chain_uses_alpaca_then_yahoo_for_us() -> None:
    registry = get_adapter_registry()
    chain = registry.get_chain("NASDAQ")
    assert len(chain) >= 2
    assert isinstance(chain[0], AlpacaAdapter) or isinstance(chain[0], YahooFinanceAdapter)
    assert isinstance(chain[-1], YahooFinanceAdapter)


def test_adapter_health_snapshot_excludes_kite() -> None:
    registry = AdapterRegistry()
    health = registry.health_snapshot()
    assert "kite" not in health
    assert "yahoo" in health
