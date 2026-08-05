from __future__ import annotations

import json
from dataclasses import asdict

import numpy as np
import pandas as pd
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.core.historical_data_service import OhlcvBar
from backend.core.symbols import normalize_symbol
from backend.db.models import BacktestRun
from backend.services.backtest_jobs import BacktestJobRequest, BacktestJobService
from backend.shared.db import Base

_engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Base.metadata.create_all(bind=_engine)
_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


@pytest.fixture
def db():
    session = _Session()
    yield session
    session.close()


class _EmptyDataService:
    _provider = type("_FakeProvider", (), {})()

    def fetch_daily_ohlcv(self, raw_symbol, market, start=None, end=None, limit=500, allow_synthetic=True):
        return normalize_symbol(raw_symbol, market), []

    def fetch_intraday_ohlcv(self, raw_symbol, timeframe, market, start=None, end=None, limit=0, allow_synthetic=True):
        return normalize_symbol(raw_symbol, market), []


class _BarDataService(_EmptyDataService):
    """Returns a deterministic 60-bar daily series so the SMA engine trades."""

    def fetch_daily_ohlcv(self, raw_symbol, market, start=None, end=None, limit=500, allow_synthetic=True):
        n = 60
        dates = pd.bdate_range("2024-01-01", periods=n)
        prices = 100.0 + np.arange(n, dtype=float) * 0.5
        bars = [
            OhlcvBar(
                date=d.strftime("%Y-%m-%d"),
                open=float(px),
                high=float(px + 0.4),
                low=float(px - 0.4),
                close=float(px + 0.1),
                volume=1_000_000,
            )
            for d, px in zip(dates, prices)
        ]
        return normalize_symbol(raw_symbol, market), bars


@pytest.fixture
def svc(monkeypatch, db):
    def _get_db():
        yield db
        yield db

    monkeypatch.setattr("backend.services.backtest_jobs.get_db", _get_db)
    service = BacktestJobService()
    return service


def _insert_run(db, run_id: str, req: BacktestJobRequest) -> None:
    db.add(BacktestRun(run_id=run_id, status="queued", request_json=json.dumps(asdict(req))))
    db.commit()


def test_fail_closed_when_market_data_unavailable(svc, db, monkeypatch) -> None:
    monkeypatch.setattr("backend.services.backtest_jobs.get_historical_data_service", lambda: _EmptyDataService())
    run_id = "bt_failclosed_1"
    req = BacktestJobRequest(symbol="AAPL", market="NASDAQ", start="2024-01-01", end="2026-01-01")
    _insert_run(db, run_id, req)

    import asyncio

    asyncio.run(svc._execute(run_id))  # noqa: SLF001
    row = db.query(BacktestRun).filter(BacktestRun.run_id == run_id).first()
    assert row.status == "failed"
    assert "Refusing to switch exchanges" in row.error
    assert "synthetic data" in row.error


def test_no_exchange_fallback_attempted(svc, db, monkeypatch) -> None:
    calls: list[tuple] = []

    class _RecordingService(_EmptyDataService):
        def fetch_daily_ohlcv(self, raw_symbol, market, start=None, end=None, limit=500, allow_synthetic=True):
            calls.append((raw_symbol, market))
            return normalize_symbol(raw_symbol, market), []

    monkeypatch.setattr("backend.services.backtest_jobs.get_historical_data_service", lambda: _RecordingService())
    run_id = "bt_no_fallback_1"
    req = BacktestJobRequest(symbol="AAPL", market="NASDAQ", start="2024-01-01", end="2026-01-01")
    _insert_run(db, run_id, req)

    import asyncio

    asyncio.run(svc._execute(run_id))  # noqa: SLF001
    row = db.query(BacktestRun).filter(BacktestRun.run_id == run_id).first()
    assert row.status == "failed"
    # Exactly one fetch on the requested market — no NYSE/NSE/BSE fallback probes.
    assert calls == [("AAPL", "NASDAQ")]


def test_synthetic_requires_explicit_toggle_and_carries_banner(svc, db, monkeypatch) -> None:
    monkeypatch.setattr("backend.services.backtest_jobs.get_historical_data_service", lambda: _EmptyDataService())
    run_id = "bt_synth_1"
    req = BacktestJobRequest(
        symbol="AAPL",
        market="NASDAQ",
        start="2024-01-01",
        end="2026-01-01",
        allow_synthetic=True,
    )
    _insert_run(db, run_id, req)

    import asyncio

    asyncio.run(svc._execute(run_id))  # noqa: SLF001
    row = db.query(BacktestRun).filter(BacktestRun.run_id == run_id).first()
    assert row.status == "done"
    payload = json.loads(row.result_json)
    assert payload["synthetic_data_used"] is True
    assert payload["warnings"] == ["SYNTHETIC DATA — NOT FOR EVALUATION"]
    assert payload["data_provenance"]["synthetic_used"] is True
    assert "SYNTHETIC DATA — NOT FOR EVALUATION" in row.logs
    assert payload["data_provenance"]["market_used"] == "NASDAQ"


def test_execution_profile_reaches_engine_and_provenance_echoed(svc, db, monkeypatch) -> None:
    monkeypatch.setattr("backend.services.backtest_jobs.get_historical_data_service", lambda: _BarDataService())
    run_id = "bt_config_1"
    req = BacktestJobRequest(
        symbol="AAPL",
        market="NASDAQ",
        start="2024-01-01",
        end="2026-01-01",
        strategy="example:sma_crossover",
        config={
            "initial_cash": 50000,
            "position_fraction": 0.5,
            "data_version_id": "dv_test_42",
            "adjusted": False,
            "execution_profile": {
                "commission_bps": 5,
                "slippage_model": "fixed_bps",
                "slippage_bps": 3,
                "spread_bps": 1,
                "market_impact_bps": 2,
                "volume_cap_pct": 10,
            },
        },
    )
    _insert_run(db, run_id, req)

    import asyncio

    asyncio.run(svc._execute(run_id))  # noqa: SLF001
    row = db.query(BacktestRun).filter(BacktestRun.run_id == run_id).first()
    assert row.status == "done", row.error
    payload = json.loads(row.result_json)

    applied = payload["applied_config"]
    assert applied["commission_bps"] == 5.0
    assert applied["slippage_bps"] == 3.0
    assert applied["spread_bps"] == 1.0
    assert applied["market_impact_bps"] == 2.0
    assert applied["volume_cap_pct"] == 10.0
    assert applied["data_version_id"] == "dv_test_42"
    assert applied["adjusted"] is False
    assert applied["allow_synthetic"] is False

    # Costs actually hit the account because trades happened.
    assert payload["costs_breakdown"]["total_paid"] > 0.0

    provenance = payload["data_provenance"]
    assert provenance["requested_market"] == "NASDAQ"
    assert provenance["market_used"] == "NASDAQ"
    assert provenance["bars"] == 60
    assert provenance["data_version_id"] == "dv_test_42"
    assert provenance["adjusted"] is False
    assert provenance["synthetic_used"] is False
    assert payload.get("synthetic_data_used") is None
