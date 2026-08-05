from __future__ import annotations

from itertools import product
from typing import Any

import numpy as np
import pandas as pd

from backend.core.backtesting_models import BacktestConfig, BacktestResult
from backend.core.historical_data_service import get_historical_data_service
from backend.core.single_asset_backtest import BacktestEngine
from backend.core.strategy_runner import StrategyRunner


def _cartesian(param_space: dict[str, list[Any]]) -> list[dict[str, Any]]:
    if not param_space:
        return []
    keys = [k for k in sorted(param_space.keys()) if isinstance(param_space.get(k), list) and param_space.get(k)]
    if not keys:
        return []
    values = [param_space[k] for k in keys]
    return [dict(zip(keys, combo)) for combo in product(*values)]


def _build_param_grid(
    param_grid: dict[str, list[Any]] | None,
    default_context: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Candidate parameter sets for train-side selection.

    Uses the caller's explicit grid when provided; otherwise derives a small
    grid from the strategy's REAL context parameters (never generic p1/p2),
    capped at the first two numeric parameters so the grid stays small.
    """
    if param_grid and any(isinstance(v, list) and v for v in param_grid.values()):
        return _cartesian(param_grid)

    ctx = default_context or {}
    numeric = [
        (k, float(v))
        for k, v in ctx.items()
        if isinstance(v, (int, float)) and not isinstance(v, bool)
    ]
    if not numeric:
        return [dict(ctx)]
    grid: dict[str, list[Any]] = {}
    for key, value in numeric[:2]:
        is_int = float(value).is_integer()

        def _mk(factor: float) -> Any:
            scaled = value * factor
            return int(round(scaled)) if is_int else round(scaled, 4)

        grid[key] = [_mk(0.8), _mk(1.0), _mk(1.2)]
    return _cartesian(grid)


def _run_strategy_once(
    strategy: str,
    frame: pd.DataFrame,
    params: dict[str, Any],
    runner: StrategyRunner,
    engine: BacktestEngine,
    symbol: str,
) -> BacktestResult:
    output = runner.run(strategy, frame, context=params)
    return engine.run(symbol=symbol, asset=symbol, frame=frame, signals=output.signals)


def _select_best_params(
    strategy: str,
    train_frame: pd.DataFrame,
    candidates: list[dict[str, Any]],
    runner: StrategyRunner,
    engine: BacktestEngine,
    symbol: str,
) -> tuple[dict[str, Any], float]:
    """Select parameters using TRAIN data only (out-of-sample test stays clean)."""
    best: dict[str, Any] = dict(candidates[0]) if candidates else {}
    best_score = float("-inf")
    for params in candidates:
        try:
            result = _run_strategy_once(strategy, train_frame, params, runner, engine, symbol)
        except Exception:
            continue
        if float(result.sharpe) > best_score:
            best_score = float(result.sharpe)
            best = params
    return best, (best_score if best_score != float("-inf") else 0.0)


def run_walk_forward_oos(
    *,
    symbol: str,
    market: str,
    strategy: str,
    start: str | None = None,
    end: str | None = None,
    limit: int = 500,
    timeframe: str = "1d",
    context: dict[str, Any] | None = None,
    config: dict[str, Any] | None = None,
    folds: int = 4,
    in_sample_ratio: float = 0.7,
    param_grid: dict[str, list[Any]] | None = None,
) -> dict[str, Any]:
    """True out-of-sample walk-forward (issue #32 Phase 4).

    For each fold the strategy is FIT/SELECTED on the training slice only, then
    RERUN on the unseen test slice. This replaces the old behavior of slicing
    the finished equity curve, which never re-evaluated the strategy.
    """
    if folds < 2:
        raise ValueError("folds must be >= 2")
    if in_sample_ratio <= 0.1 or in_sample_ratio >= 0.95:
        raise ValueError("in_sample_ratio must be between 0.1 and 0.95")

    svc = get_historical_data_service()
    if str(timeframe or "1d") == "1d":
        _symbol, bars = svc.fetch_daily_ohlcv(
            raw_symbol=symbol, market=market, start=start, end=end, limit=limit, allow_synthetic=False
        )
    else:
        _symbol, bars = svc.fetch_intraday_ohlcv(
            raw_symbol=symbol, timeframe=timeframe, market=market, start=start, end=end, limit=limit, allow_synthetic=False
        )
    if not bars:
        return _empty_result()

    frame = pd.DataFrame(
        [
            {
                "date": b.date,
                "open": b.open,
                "high": b.high,
                "low": b.low,
                "close": b.close,
                "volume": b.volume,
            }
            for b in bars
        ]
    ).reset_index(drop=True)
    n = len(frame)
    if n < 30:
        return _empty_result()

    candidates = _build_param_grid(param_grid, context)
    if not candidates:
        candidates = [dict(context or {})]
    runner = StrategyRunner(timeout_seconds=2.0)
    engine = BacktestEngine(BacktestConfig(**(config or {})))

    fold_size = max(20, n // folds)
    windows: list[dict[str, Any]] = []
    for i in range(folds):
        f_start = i * fold_size
        f_end = min(n, f_start + fold_size)
        if f_end - f_start < 20:
            continue
        split = max(10, int((f_end - f_start) * in_sample_ratio))
        train = frame.iloc[f_start : f_start + split]
        test = frame.iloc[f_start + split : f_end]
        if len(test) < 5:
            continue

        selected_params, train_sharpe = _select_best_params(strategy, train, candidates, runner, engine, symbol)
        test_result = _run_strategy_once(strategy, test, selected_params, runner, engine, symbol)

        windows.append(
            {
                "window": f"Fold {i + 1}",
                "train_start": str(train.iloc[0]["date"]),
                "train_end": str(train.iloc[-1]["date"]),
                "test_start": str(test.iloc[0]["date"]),
                "test_end": str(test.iloc[-1]["date"]),
                "sharpe": round(float(test_result.sharpe), 6),
                "total_return": round(float(test_result.total_return), 6),
                "max_drawdown": round(float(test_result.max_drawdown), 6),
                "train_sharpe": round(float(train_sharpe), 6),
                "selected_params": selected_params,
                "test_trades": len(test_result.closed_trades),
            }
        )

    if not windows:
        return _empty_result()

    avg_train = float(np.mean([w["train_sharpe"] for w in windows]))
    avg_test = float(np.mean([w["sharpe"] for w in windows]))
    return {
        "windows": windows,
        "summary": {
            "avg_train_sharpe": round(avg_train, 6),
            "avg_test_sharpe": round(avg_test, 6),
            "degradation": round(avg_train - avg_test, 6),
        },
        "method": "train_fit_then_unseen_test",
    }


def _empty_result() -> dict[str, Any]:
    return {
        "windows": [],
        "summary": {"avg_train_sharpe": 0.0, "avg_test_sharpe": 0.0, "degradation": 0.0},
        "method": "train_fit_then_unseen_test",
    }


def run_walk_forward_validation(
    equity_curve: list[dict[str, Any]],
    folds: int = 4,
    in_sample_ratio: float = 0.7,
) -> dict[str, Any]:
    """LEGACY equity-curve splitter — kept for backward compatibility only.

    Issue #32 Phase 4: new code must use run_walk_forward_oos(), which fits on
    training data and reruns the strategy on unseen data.
    """
    if folds < 2:
        raise ValueError("folds must be >= 2")
    if in_sample_ratio <= 0.1 or in_sample_ratio >= 0.95:
        raise ValueError("in_sample_ratio must be between 0.1 and 0.95")

    frame = pd.DataFrame(equity_curve)
    if frame.empty or "equity" not in frame.columns:
        return {"folds": [], "summary": {"avg_in_sample_sharpe": 0.0, "avg_out_sample_sharpe": 0.0}}
    frame["equity"] = pd.to_numeric(frame["equity"], errors="coerce")
    frame = frame.dropna(subset=["equity"]).reset_index(drop=True)
    if len(frame) < 20:
        return {"folds": [], "summary": {"avg_in_sample_sharpe": 0.0, "avg_out_sample_sharpe": 0.0}}

    returns = frame["equity"].pct_change().replace([np.inf, -np.inf], np.nan).dropna().reset_index(drop=True)
    n = len(returns)
    fold_size = max(10, n // folds)

    fold_metrics: list[dict[str, Any]] = []
    for i in range(folds):
        start = i * fold_size
        end = min(n, start + fold_size)
        if end - start < 10:
            continue
        fold_slice = returns.iloc[start:end]
        split = max(5, int(len(fold_slice) * in_sample_ratio))
        in_sample = fold_slice.iloc[:split]
        out_sample = fold_slice.iloc[split:]
        if out_sample.empty:
            continue
        in_vol = float(in_sample.std() * np.sqrt(252.0))
        out_vol = float(out_sample.std() * np.sqrt(252.0))
        in_sharpe = float((in_sample.mean() * 252.0) / in_vol) if in_vol > 0 else 0.0
        out_sharpe = float((out_sample.mean() * 252.0) / out_vol) if out_vol > 0 else 0.0
        fold_metrics.append(
            {
                "fold": i + 1,
                "start_index": int(start),
                "end_index": int(end),
                "in_sample_sharpe": round(in_sharpe, 6),
                "out_sample_sharpe": round(out_sharpe, 6),
                "in_sample_return": round(float((1 + in_sample).prod() - 1), 6),
                "out_sample_return": round(float((1 + out_sample).prod() - 1), 6),
            }
        )

    if not fold_metrics:
        return {"folds": [], "summary": {"avg_in_sample_sharpe": 0.0, "avg_out_sample_sharpe": 0.0}}
    avg_in = float(np.mean([f["in_sample_sharpe"] for f in fold_metrics]))
    avg_out = float(np.mean([f["out_sample_sharpe"] for f in fold_metrics]))
    return {
        "folds": fold_metrics,
        "summary": {
            "avg_in_sample_sharpe": round(avg_in, 6),
            "avg_out_sample_sharpe": round(avg_out, 6),
            "degradation": round(avg_in - avg_out, 6),
        },
    }
