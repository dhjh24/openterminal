from __future__ import annotations

import pandas as pd
import pytest

from backend.core.backtesting_models import BacktestConfig
from backend.core.single_asset_backtest import BacktestEngine


def _daily_frame(closes: list[float]) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "date": [f"2026-01-{i + 1:02d}" for i in range(len(closes))],
            "open": closes,
            "high": [c + 1 for c in closes],
            "low": [c - 1 for c in closes],
            "close": closes,
            "volume": [1_000_000] * len(closes),
        }
    )


# ── Fill timing (issue #32 Phase 3) ──────────────────────────────────────────


def test_daily_signal_fills_at_next_tradable_bar_by_default() -> None:
    frame = _daily_frame([100.0, 102.0, 104.0, 106.0])
    # Signal flips to 1 at bar 1 (close 102) → default fill must be bar 2.
    signals = pd.Series([0, 1, 0, 0], dtype=int)
    result = BacktestEngine(BacktestConfig()).run("TEST", frame, signals)

    assert result.trades[0].date == "2026-01-03"  # bar 2, not the signal bar
    assert result.trades[0].price == 104.0
    assert result.applied_config["fill_delay_bars"] == 1
    assert result.applied_config["signal_timing"] == "bar_close"
    assert result.applied_config["fill_timing"] == "next_bar"


def test_daily_explicit_zero_delay_fills_same_bar() -> None:
    frame = _daily_frame([100.0, 102.0, 104.0, 106.0])
    signals = pd.Series([0, 1, 0, 0], dtype=int)
    result = BacktestEngine(BacktestConfig(fill_delay_bars=0)).run("TEST", frame, signals)

    assert result.trades[0].date == "2026-01-02"
    assert result.trades[0].price == 102.0
    assert result.applied_config["fill_timing"] == "same_bar"


def test_intraday_signal_fills_at_next_bar_open() -> None:
    frame = pd.DataFrame(
        {
            "date": ["2026-01-02 09:30", "2026-01-02 09:45", "2026-01-02 10:00", "2026-01-02 10:15"],
            "open": [100.0, 101.0, 102.0, 103.0],
            "high": [100.5, 101.5, 102.5, 103.5],
            "low": [99.5, 100.5, 101.5, 102.5],
            "close": [100.5, 101.5, 102.5, 103.5],
            "volume": [1_000_000] * 4,
        }
    )
    signals = pd.Series([0, 1, 0, 0], dtype=int)
    result = BacktestEngine(BacktestConfig(timeframe="15m")).run("TEST", frame, signals)

    # Signal at 09:45 close fills at 10:00 OPEN (102.0), not the close (102.5).
    assert result.trades[0].price == 102.0
    assert result.trades[0].date == "2026-01-02 10:00"


# ── Closed-trade ledger (issue #32 Phase 3) ──────────────────────────────────


def test_long_round_trip_recorded() -> None:
    frame = _daily_frame([100.0, 102.0, 104.0, 106.0])
    signals = pd.Series([0, 1, 0, 0], dtype=int)
    result = BacktestEngine(BacktestConfig()).run("TEST", frame, signals)

    assert len(result.closed_trades) == 1
    trade = result.closed_trades[0]
    assert trade.direction == "LONG"
    assert trade.entry_price == 104.0
    assert trade.exit_price == 106.0
    assert trade.gross_pnl == pytest.approx(2.0)
    assert trade.net_pnl == pytest.approx(2.0)
    assert trade.holding_period_minutes > 0


def test_short_round_trip_recorded_and_counts_as_win() -> None:
    # Falling prices: short sells at 102 (bar 2), covers at 98 (bar 4).
    frame = _daily_frame([106.0, 104.0, 102.0, 100.0, 98.0])
    signals = pd.Series([0, -1, -1, 0, 0], dtype=int)
    result = BacktestEngine(BacktestConfig()).run("TEST", frame, signals)

    assert len(result.closed_trades) == 1
    trade = result.closed_trades[0]
    assert trade.direction == "SHORT"
    assert trade.entry_price == 102.0
    assert trade.exit_price == 98.0
    assert trade.gross_pnl == pytest.approx(4.0)
    assert trade.net_pnl == pytest.approx(4.0)
    # The short win must be counted (previously BUY→SELL pairing skipped it).
    assert result.win_rate == pytest.approx(100.0)


def test_mixed_long_and_short_metrics_from_ledger() -> None:
    # LONG: buy 96 → sell 108 (+12). SHORT: sell 104 → cover 96 (+8).
    frame = _daily_frame([100.0, 96.0, 104.0, 108.0, 108.0, 104.0, 100.0, 96.0])
    signals = pd.Series([1, 1, 0, 0, -1, -1, 0, 0], dtype=int)
    result = BacktestEngine(BacktestConfig()).run("TEST", frame, signals)

    assert [t.direction for t in result.closed_trades] == ["LONG", "SHORT"]
    assert [t.gross_pnl for t in result.closed_trades] == [pytest.approx(12.0), pytest.approx(8.0)]
    assert result.win_rate == pytest.approx(100.0)
    assert result.avg_win == pytest.approx(10.0)
    assert result.profit_factor == 0.0  # no losses → gross_loss == 0


def test_ledger_costs_reconcile_with_cost_breakdown() -> None:
    frame = _daily_frame([100.0, 96.0, 104.0, 108.0, 108.0, 104.0, 100.0, 96.0])
    signals = pd.Series([1, 1, 0, 0, -1, -1, 0, 0], dtype=int)
    cfg = BacktestConfig(commission_bps=10.0, slippage_bps=5.0, spread_bps=2.0, market_impact_bps=3.0)
    result = BacktestEngine(cfg).run("TEST", frame, signals)

    ledger_commission = sum(t.commission for t in result.closed_trades)
    ledger_slippage = sum(t.slippage for t in result.closed_trades)
    ledger_spread_impact = sum(t.spread_impact_cost for t in result.closed_trades)
    assert ledger_commission == pytest.approx(result.costs_breakdown["commission_paid"], abs=1e-6)
    assert ledger_slippage == pytest.approx(result.costs_breakdown["slippage_paid"], abs=1e-6)
    assert ledger_spread_impact == pytest.approx(
        result.costs_breakdown["spread_paid"] + result.costs_breakdown["impact_paid"], abs=1e-6
    )


def test_net_pnl_equals_gross_minus_costs() -> None:
    frame = _daily_frame([100.0, 96.0, 104.0, 108.0, 108.0, 104.0, 100.0, 96.0])
    signals = pd.Series([1, 1, 0, 0, -1, -1, 0, 0], dtype=int)
    cfg = BacktestConfig(commission_bps=25.0)
    result = BacktestEngine(cfg).run("TEST", frame, signals)

    for trade in result.closed_trades:
        allocated = trade.commission + trade.slippage + trade.spread_impact_cost
        assert trade.net_pnl == pytest.approx(trade.gross_pnl - allocated, abs=1e-6)


def test_consecutive_losses_from_ledger_sequence() -> None:
    # Two losing round trips in a row (buy 108, sell 100, twice).
    frame = _daily_frame([100.0, 108.0, 100.0, 108.0, 100.0, 108.0])
    signals = pd.Series([1, 0, 1, 0, 1, 0], dtype=int)
    result = BacktestEngine(BacktestConfig()).run("TEST", frame, signals)

    assert len(result.closed_trades) == 2
    assert all(t.net_pnl < 0 for t in result.closed_trades)
    assert result.max_consecutive_losses == 2
