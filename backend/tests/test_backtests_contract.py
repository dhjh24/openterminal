from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.api.routes import backtests


class _FakeBacktestService:
    """In-memory stand-in for BacktestJobService used by contract tests."""

    def __init__(self) -> None:
        self.submitted: list = []
        self._statuses: dict[str, str] = {}
        self._results: dict[str, dict | None] = {}

    async def submit(self, req):  # noqa: ANN001
        self.submitted.append(req)
        run_id = f"bt_contract_{len(self.submitted)}"
        self._statuses[run_id] = "queued"
        self._results[run_id] = None
        return run_id

    async def get_status(self, run_id: str):
        if run_id not in self._statuses:
            return {"run_id": run_id, "status": "not_found"}
        return {"run_id": run_id, "status": self._statuses[run_id]}

    async def get_result(self, run_id: str):
        if run_id not in self._statuses:
            return {"run_id": run_id, "status": "not_found"}
        return {
            "run_id": run_id,
            "status": self._statuses[run_id],
            "result": self._results[run_id],
            "logs": "",
            "error": "",
        }


@pytest.fixture
def contract_service() -> _FakeBacktestService:
    return _FakeBacktestService()


@pytest.fixture
def client(monkeypatch, contract_service: _FakeBacktestService) -> TestClient:
    monkeypatch.setattr(backtests, "get_backtest_job_service", lambda: contract_service)
    app = FastAPI()
    # Mirror production wiring: the backtests router is mounted under /api.
    app.include_router(backtests.router, prefix="/api")
    return TestClient(app)


# ── Canonical contract: POST /api/v1/backtest/jobs ───────────────────────────


def test_post_jobs_submits_and_returns_run_id(client: TestClient, contract_service: _FakeBacktestService) -> None:
    resp = client.post(
        "/api/v1/backtest/jobs",
        json={
            "symbol": "AAPL",
            "asset": "AAPL",
            "market": "NASDAQ",
            "start": "2024-01-01",
            "end": "2026-01-01",
            "timeframe": "1d",
            "strategy": "example:sma_crossover",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["run_id"] == "bt_contract_1"
    assert body["status"] == "queued"
    assert len(contract_service.submitted) == 1


def test_post_jobs_timeframe_forwarded_to_request(client: TestClient, contract_service: _FakeBacktestService) -> None:
    client.post("/api/v1/backtest/jobs", json={"symbol": "AAPL", "market": "NASDAQ", "timeframe": "15m"})
    req = contract_service.submitted[0]
    assert req.timeframe == "15m"
    assert req.market == "NASDAQ"
    assert req.symbol == "AAPL"


def test_post_jobs_defaults_timeframe_to_1d(client: TestClient, contract_service: _FakeBacktestService) -> None:
    client.post("/api/v1/backtest/jobs", json={"symbol": "AAPL"})
    assert contract_service.submitted[0].timeframe == "1d"


# ── Canonical contract: GET /api/v1/backtest/jobs/{run_id} ───────────────────


def test_get_jobs_status_polls(client: TestClient, contract_service: _FakeBacktestService) -> None:
    run_id = client.post("/api/v1/backtest/jobs", json={"symbol": "AAPL"}).json()["run_id"]
    contract_service._statuses[run_id] = "running"  # noqa: SLF001
    resp = client.get(f"/api/v1/backtest/jobs/{run_id}")
    assert resp.status_code == 200
    assert resp.json() == {"run_id": run_id, "status": "running"}


def test_get_jobs_status_missing_returns_404(client: TestClient) -> None:
    resp = client.get("/api/v1/backtest/jobs/bt_missing")
    assert resp.status_code == 404


# ── Canonical contract: GET /api/v1/backtest/jobs/{run_id}/result ────────────


def test_get_jobs_result_returns_completed_payload(client: TestClient, contract_service: _FakeBacktestService) -> None:
    run_id = client.post("/api/v1/backtest/jobs", json={"symbol": "AAPL"}).json()["run_id"]
    contract_service._statuses[run_id] = "done"  # noqa: SLF001
    contract_service._results[run_id] = {  # noqa: SLF001
        "symbol": "AAPL",
        "bars": 2,
        "initial_cash": 100000.0,
        "final_equity": 101000.0,
        "equity_curve": [{"date": "2024-01-02", "equity": 100000.0}, {"date": "2024-01-03", "equity": 101000.0}],
        "trades": [],
    }
    resp = client.get(f"/api/v1/backtest/jobs/{run_id}/result")
    assert resp.status_code == 200
    body = resp.json()
    assert body["run_id"] == run_id
    assert body["status"] == "done"
    assert body["error"] == ""
    assert body["result"]["symbol"] == "AAPL"
    assert len(body["result"]["equity_curve"]) == 2


# ── Deprecated aliases still answer (backward compatibility) ─────────────────


def test_legacy_v1_aliases_still_work(client: TestClient) -> None:
    resp = client.post("/api/v1/backtest/submit", json={"symbol": "AAPL", "market": "NASDAQ"})
    assert resp.status_code == 200
    run_id = resp.json()["run_id"]

    status = client.get(f"/api/v1/backtest/status/{run_id}")
    assert status.status_code == 200
    assert status.json()["status"] == "queued"

    result = client.get(f"/api/v1/backtest/result/{run_id}")
    assert result.status_code == 200
    assert result.json()["run_id"] == run_id


def test_legacy_backtests_aliases_still_work(client: TestClient) -> None:
    resp = client.post("/api/backtests", json={"symbol": "AAPL", "market": "NASDAQ"})
    assert resp.status_code == 200
    run_id = resp.json()["run_id"]

    status = client.get(f"/api/backtests/{run_id}/status")
    assert status.status_code == 200

    result = client.get(f"/api/backtests/{run_id}/result")
    assert result.status_code == 200


# ── OpenAPI surface: canonical contract is the live one, legacy marked deprecated ──


def test_openapi_marks_legacy_deprecated_and_canonical_live(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    jobs_post = spec["paths"]["/api/v1/backtest/jobs"]["post"]
    legacy_post = spec["paths"]["/api/v1/backtest/submit"]["post"]
    legacy_status = spec["paths"]["/api/v1/backtest/status/{run_id}"]["get"]
    assert "deprecated" not in jobs_post or jobs_post["deprecated"] is False
    assert legacy_post["deprecated"] is True
    assert legacy_status["deprecated"] is True
