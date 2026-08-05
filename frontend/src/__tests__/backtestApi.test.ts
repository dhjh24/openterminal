import { afterEach, describe, expect, it, vi } from "vitest";

import * as backtestApi from "../api/backtest";

vi.mock("../api/base", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { api } from "../api/base";

const mockedPost = vi.mocked(api.post);
const mockedGet = vi.mocked(api.get);

afterEach(() => {
  vi.clearAllMocks();
});

describe("backtest API client — canonical /v1/backtest/jobs contract (issue #32)", () => {
  it("submitBacktestJob POSTs /v1/backtest/jobs with the full payload", async () => {
    mockedPost.mockResolvedValue({ data: { run_id: "bt_abc123", status: "queued" } });
    const payload = {
      symbol: "AAPL",
      asset: "AAPL",
      market: "NASDAQ",
      start: "2024-01-01",
      end: "2026-01-01",
      timeframe: "1d",
      strategy: "example:sma_crossover",
      context: {},
      config: { initial_cash: 100000, position_fraction: 1 },
    };
    const res = await backtestApi.submitBacktestJob(payload);

    expect(mockedPost).toHaveBeenCalledWith("/v1/backtest/jobs", payload);
    expect(res.run_id).toBe("bt_abc123");
    expect(res.status).toBe("queued");
  });

  it("fetchBacktestJobStatus GETs /v1/backtest/jobs/{run_id}", async () => {
    mockedGet.mockResolvedValue({ data: { run_id: "bt_abc123", status: "running" } });
    const res = await backtestApi.fetchBacktestJobStatus("bt_abc123");

    expect(mockedGet).toHaveBeenCalledWith("/v1/backtest/jobs/bt_abc123");
    expect(res.status).toBe("running");
  });

  it("fetchBacktestJobResult GETs /v1/backtest/jobs/{run_id}/result", async () => {
    mockedGet.mockResolvedValue({
      data: { run_id: "bt_abc123", status: "done", result: { asset: "AAPL" }, logs: "", error: "" },
    });
    const res = await backtestApi.fetchBacktestJobResult("bt_abc123");

    expect(mockedGet).toHaveBeenCalledWith("/v1/backtest/jobs/bt_abc123/result");
    expect(res.status).toBe("done");
    expect(res.result?.asset).toBe("AAPL");
  });

  it("exposes no dead /v1/backtest/v1/jobs functions", () => {
    expect((backtestApi as Record<string, unknown>).submitBacktestV1).toBeUndefined();
    expect((backtestApi as Record<string, unknown>).fetchBacktestV1Status).toBeUndefined();
    expect((backtestApi as Record<string, unknown>).fetchBacktestV1Result).toBeUndefined();
  });
});
