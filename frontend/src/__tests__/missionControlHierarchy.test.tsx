import { describe, expect, it } from "vitest";

import { buildActionQueue } from "../home/actionQueue";
import { readRecentTools, recordRecentTool, RECENT_TOOLS_STORAGE_KEY } from "../home/recentTools";

describe("buildActionQueue", () => {
  it("surfaces provider, alert, backtest, paper, and empty-portfolio actions", () => {
    const items = buildActionQueue({
      alertCount: 2,
      marketQuotesReady: false,
      snapshotAgeMs: 10_000,
      newsCount: 0,
      backtestPresetCount: 3,
      paperPositionCount: 1,
      holdingsCount: 0,
      providerIssues: true,
    });

    expect(items.map((item) => item.id)).toEqual([
      "provider-issues",
      "stale-quotes",
      "open-alerts",
      "unfinished-backtest",
      "paper-positions",
      "empty-portfolio",
    ]);
  });

  it("returns an empty queue when the desk is healthy", () => {
    expect(
      buildActionQueue({
        alertCount: 0,
        marketQuotesReady: true,
        snapshotAgeMs: 1_000,
        newsCount: 4,
        backtestPresetCount: 0,
        paperPositionCount: 0,
        holdingsCount: 2,
        providerIssues: false,
      }),
    ).toEqual([]);
  });
});

describe("recentTools", () => {
  it("records and dedupes recent tools", () => {
    localStorage.removeItem(RECENT_TOOLS_STORAGE_KEY);
    recordRecentTool("/equity/screener", "Screener");
    recordRecentTool("/backtesting", "Backtest");
    recordRecentTool("/equity/screener", "Screener");
    const recent = readRecentTools();
    expect(recent[0]?.to).toBe("/equity/screener");
    expect(recent[1]?.to).toBe("/backtesting");
    expect(recent).toHaveLength(2);
  });
});
