from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from backend.core.historical_data_service import OhlcvBar
from backend.core.symbols import normalize_symbol
from backend.core.walk_forward import run_walk_forward_oos, run_walk_forward_validation


class _TrendingDataService:
    _provider = type("_FakeProvider", (), {})()

    def fetch_daily_ohlcv(self, raw_symbol, market, start=None, end=None, limit=500, allow_synthetic=True):
        n = 200
        dates = pd.bdate_range("2023-01-01", periods=n)
        prices = 100.0 + np.arange(n, dtype=float) * 0.4
        bars = [
            OhlcvBar(
                date=d.strftime("%Y-%m-%d"),
                open=float(px),
                high=float(px + 0.5),
                low=float(px - 0.5),
                close=float(px + 0.1),
                volume=1_000_000,
            )
            for d, px in zip(dates, prices)
        ]
        return normalize_symbol(raw_symbol, market), bars


class _EmptyDataService(_TrendingDataService):
    def fetch_daily_ohlcv(self, raw_symbol, market, start=None, end=None, limit=500, allow_synthetic=True):
        return normalize_symbol(raw_symbol, market), []


def _run(monkeypatch, **overrides):
    monkeypatch.setattr("backend.core.walk_forward.get_historical_data_service", lambda: _TrendingDataService())
    defaults = dict(
        symbol="AAPL",
        market="NASDAQ",
        strategy="example:sma_crossover",
        context={"short_window": 20, "long_window": 50},
        folds=3,
        in_sample_ratio=0.7,
    )
    defaults.update(overrides)
    return run_walk_forward_oos(**defaults)


def test_oos_walk_forward_reruns_strategy_on_unseen_data(monkeypatch) -> None:
    result = _run(monkeypatch)

    assert result["method"] == "train_fit_then_unseen_test"
    assert len(result["windows"]) == 3
    for window in result["windows"]:
        # Training window strictly precedes the unseen test window.
        assert window["train_start"] < window["test_start"]
        assert window["train_end"] < window["test_end"]
        # Params were selected from the strategy's REAL parameter grid.
        assert window["selected_params"]["short_window"] in {16, 20, 24}
        assert window["selected_params"]["long_window"] in {40, 50, 60}
        assert "p1" not in window["selected_params"]
        assert window["test_trades"] >= 0
    assert "avg_train_sharpe" in result["summary"]
    assert "avg_test_sharpe" in result["summary"]
    assert "degradation" in result["summary"]


def test_oos_honors_explicit_param_grid(monkeypatch) -> None:
    result = _run(monkeypatch, param_grid={"short_window": [10, 20], "long_window": [50]})
    assert len(result["windows"]) == 3
    for window in result["windows"]:
        assert window["selected_params"]["short_window"] in {10, 20}
        assert window["selected_params"]["long_window"] == 50


def test_oos_fails_closed_when_market_data_unavailable(monkeypatch) -> None:
    monkeypatch.setattr("backend.core.walk_forward.get_historical_data_service", lambda: _EmptyDataService())
    result = run_walk_forward_oos(
        symbol="AAPL",
        market="NASDAQ",
        strategy="example:sma_crossover",
        context={"short_window": 20, "long_window": 50},
        folds=3,
    )
    assert result["windows"] == []
    assert result["method"] == "train_fit_then_unseen_test"
    assert result["summary"]["avg_test_sharpe"] == 0.0


def test_oos_intraday_timeframe_fetches_intraday(monkeypatch) -> None:
    fetched: list[str] = []

    class _RecordingService(_TrendingDataService):
        def fetch_intraday_ohlcv(self, raw_symbol, timeframe, market, start=None, end=None, limit=0, allow_synthetic=True):
            fetched.append(timeframe)
            return normalize_symbol(raw_symbol, market), []

    monkeypatch.setattr("backend.core.walk_forward.get_historical_data_service", lambda: _RecordingService())
    run_walk_forward_oos(
        symbol="AAPL",
        market="NASDAQ",
        strategy="example:sma_crossover",
        context={"short_window": 20, "long_window": 50},
        timeframe="15m",
        folds=2,
    )
    assert fetched == ["15m"]


def test_legacy_equity_curve_splitter_still_available() -> None:
    equity = [{"date": f"2024-01-{i:02d}", "equity": 100000 + i * 100} for i in range(1, 61)]
    result = run_walk_forward_validation(equity, folds=3, in_sample_ratio=0.7)
    assert "folds" in result
    assert "avg_in_sample_sharpe" in result["summary"]
    assert "avg_out_sample_sharpe" in result["summary"]


def test_oos_rejects_invalid_folds() -> None:
    with pytest.raises(ValueError):
        run_walk_forward_oos(
            symbol="AAPL",
            market="NASDAQ",
            strategy="example:sma_crossover",
            context={},
            folds=1,
        )
