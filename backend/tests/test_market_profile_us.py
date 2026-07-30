from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.shared.market_guard import assert_exchange_allowed
from backend.shared.market_profile import (
    DEFAULT_US_RISK_FREE_RATE_PCT,
    get_market_profile,
    get_us_risk_free_rate_pct,
    is_supported_exchange,
    unsupported_market_detail,
)


@pytest.fixture(autouse=True)
def _us_profile_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MARKET_PROFILE", "US")
    monkeypatch.delenv("OPENTERMINALUI_MARKET_PROFILE", raising=False)


def test_get_market_profile_rejects_legacy(monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.shared.market_profile import MarketProfileError

    for value in ("MULTI", "IN", "INDIA", "ALL"):
        monkeypatch.setenv("MARKET_PROFILE", value)
        with pytest.raises(MarketProfileError):
            get_market_profile()


def test_unsupported_india_exchange_detail_structure() -> None:
    detail = unsupported_market_detail("NSE")
    assert detail["error"] == "unsupported_market"
    assert detail["exchange"] == "NSE"
    assert detail["market_profile"] == "US"
    assert "NASDAQ" in detail["supported_exchanges"]
    assert "NSE" not in detail["supported_exchanges"]


def test_is_supported_exchange_nasdaq_vs_nse_under_us() -> None:
    assert is_supported_exchange("NASDAQ") is True
    assert is_supported_exchange("NYSE") is True
    assert is_supported_exchange("NSE") is False
    assert is_supported_exchange("BSE") is False
    assert is_supported_exchange("AMEX") is False
    assert is_supported_exchange("CBOE") is False
    assert is_supported_exchange("CME") is False
    assert is_supported_exchange(None) is True


def test_unsupported_detail_stable_fields() -> None:
    detail = unsupported_market_detail("NSE")
    assert detail["code"] == "unsupported_market"
    assert detail["input"] == "NSE"
    assert "allowed_markets" in detail
    assert "NASDAQ" in detail["allowed_markets"]


def test_risk_free_rate_percent_vs_decimal_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("US_RISK_FREE_RATE", raising=False)
    monkeypatch.delenv("OPENTERMINALUI_US_RISK_FREE_RATE", raising=False)
    assert get_us_risk_free_rate_pct() == DEFAULT_US_RISK_FREE_RATE_PCT

    monkeypatch.setenv("US_RISK_FREE_RATE", "4.5")
    assert get_us_risk_free_rate_pct() == 4.5

    monkeypatch.setenv("US_RISK_FREE_RATE", "0.045")
    assert get_us_risk_free_rate_pct() == pytest.approx(4.5)

    monkeypatch.setenv("US_RISK_FREE_RATE", "not-a-number")
    assert get_us_risk_free_rate_pct() == DEFAULT_US_RISK_FREE_RATE_PCT


def test_assert_exchange_allowed_raises_400_for_nse() -> None:
    with pytest.raises(HTTPException) as exc:
        assert_exchange_allowed("NSE")
    assert exc.value.status_code == 400
    detail = exc.value.detail
    assert isinstance(detail, dict)
    assert detail.get("error") == "unsupported_market"


def test_assert_exchange_allowed_allows_nasdaq() -> None:
    assert_exchange_allowed("NASDAQ")
