from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from backend.core.backtesting_models import BacktestConfig
from backend.core.single_asset_backtest import BacktestEngine


def _frame(n: int = 80, volume: float = 1_000_000.0) -> pd.DataFrame:
    """Rising-price frame so trades actually happen after a short warmup."""
    dates = pd.bdate_range("2024-01-01", periods=n)
    prices = 100.0 + np.arange(n, dtype=float) * 0.5
    return pd.DataFrame(
        {
            "date": [d.strftime("%Y-%m-%d") for d in dates],
            "open": prices,
            "high": prices + 0.4,
            "low": prices - 0.4,
            "close": prices + 0.1,
            "volume": [volume] * n,
        }
    )


def _signals(n: int, warmup: int = 20) -> pd.Series:
    return pd.Series([1 if i >= warmup else 0 for i in range(n)], dtype=int)


def test_engine_without_costs_pays_nothing() -> None:
    result = BacktestEngine(BacktestConfig()).run("AAPL", _frame(), _signals(80))
    assert result.costs_breakdown["total_paid"] == 0.0
    assert result.applied_config["commission_bps"] == 0.0


def test_engine_applies_commission_slippage_spread_impact() -> None:
    cfg = BacktestConfig(
        commission_bps=10.0,
        slippage_bps=5.0,
        spread_bps=2.0,
        market_impact_bps=3.0,
    )
    result = BacktestEngine(cfg).run("AAPL", _frame(), _signals(80))

    assert result.costs_breakdown["total_paid"] > 0.0
    assert result.costs_breakdown["commission_paid"] > 0.0
    assert result.costs_breakdown["slippage_paid"] > 0.0
    assert result.costs_breakdown["spread_paid"] > 0.0
    assert result.costs_breakdown["impact_paid"] > 0.0
    assert result.applied_config["commission_bps"] == 10.0
    assert result.applied_config["spread_bps"] == 2.0
    assert result.applied_config["market_impact_bps"] == 3.0

    free = BacktestEngine(BacktestConfig()).run("AAPL", _frame(), _signals(80))
    assert result.final_equity < free.final_equity


def test_engine_legacy_fee_bps_alias_still_applies() -> None:
    result = BacktestEngine(BacktestConfig(fee_bps=10.0)).run("AAPL", _frame(), _signals(80))
    assert result.costs_breakdown["commission_paid"] > 0.0
    assert result.applied_config["commission_bps"] == 10.0


def test_engine_volume_cap_limits_trade_quantity() -> None:
    # Tiny bar volume: 10% cap = 10 shares; position_size wants 1000.
    frame = _frame(volume=100.0)
    cfg = BacktestConfig(position_size=1000.0, volume_cap_pct=10.0)
    result = BacktestEngine(cfg).run("AAPL", frame, _signals(80, warmup=5))

    assert result.trades, "expected trades to exist"
    for trade in result.trades:
        assert abs(trade.quantity) <= 10.0 + 1e-9
    assert result.applied_config["volume_cap_pct"] == 10.0


def test_engine_echoes_data_version_and_adjusted() -> None:
    cfg = BacktestConfig(
        data_version_id="dv_test_42",
        adjusted=False,
        position_fraction=0.5,
        fill_delay_bars=1,
    )
    result = BacktestEngine(cfg).run("AAPL", _frame(), _signals(80))
    assert result.applied_config["data_version_id"] == "dv_test_42"
    assert result.applied_config["adjusted"] is False
    assert result.applied_config["position_fraction"] == 0.5
    assert result.applied_config["fill_delay_bars"] == 1


def test_engine_reports_unsupported_slippage_model() -> None:
    cfg = BacktestConfig(slippage_model="bogus_model")
    result = BacktestEngine(cfg).run("AAPL", _frame(), _signals(80))
    assert result.unsupported_settings == ["slippage_model=bogus_model"]
    assert result.applied_config["slippage_model"] == "fixed_bps"


def test_engine_volume_weighted_slippage_model_applies_costs() -> None:
    cfg = BacktestConfig(slippage_model="volume_weighted", slippage_bps=1.0)
    result = BacktestEngine(cfg).run("AAPL", _frame(), _signals(80))
    assert result.applied_config["slippage_model"] == "volume_weighted"
    assert result.costs_breakdown["slippage_paid"] >= 0.0


def test_engine_bad_config_rejected() -> None:
    with pytest.raises(ValueError):
        BacktestConfig(volume_cap_pct=150.0)
