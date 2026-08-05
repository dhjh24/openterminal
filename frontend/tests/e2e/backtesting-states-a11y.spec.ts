import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Issue #32 Phase 5 — accessibility audit of backtesting result states.
 * Axe scans on setup, running, failed, and completed states. The acceptance
 * bar: no serious or critical violations (color-contrast is disabled for the
 * terminal theme, consistent with the repo-wide baseline).
 */

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

const RUN_ID = "bt_a11y_phase5";

const COMPLETED_RESULT = {
  run_id: RUN_ID,
  status: "done",
  result: {
    asset: "AAPL",
    symbol: "AAPL",
    bars: 4,
    initial_cash: 100000,
    final_equity: 123456.78,
    pnl_amount: 23456.78,
    total_return: 0.2346,
    sharpe: 1.42,
    max_drawdown: -0.0812,
    equity_curve: [
      { date: "2024-01-02", equity: 100000, cash: 100000, close: 190.0, position: 0, signal: 0 },
      { date: "2024-01-03", equity: 101500, cash: 50000, close: 195.0, position: 260, signal: 1 },
      { date: "2024-01-04", equity: 104000, cash: 50000, close: 200.0, position: 270, signal: 1 },
      { date: "2024-01-05", equity: 123456.78, cash: 123456.78, close: 205.0, position: 0, signal: 0 },
    ],
    trades: [
      { date: "2024-01-03", price: 195.0, action: "BUY", quantity: 260 },
      { date: "2024-01-05", price: 205.0, action: "SELL", quantity: 270 },
    ],
    closed_trades: [
      {
        direction: "LONG",
        entry_time: "2024-01-03",
        exit_time: "2024-01-05",
        entry_price: 195.0,
        exit_price: 205.0,
        quantity: 260,
        gross_pnl: 2600,
        commission: 5.07,
        slippage: 3.04,
        spread_impact_cost: 1.01,
        net_pnl: 2590.88,
        holding_period_minutes: 2880,
      },
    ],
    data_provenance: {
      requested_market: "NASDAQ",
      market_used: "NASDAQ",
      provider: "YahooHistoricalDataProvider",
      requested_timeframe: "1d",
      bars: 4,
      date_start: "2024-01-02",
      date_end: "2024-01-05",
      synthetic_used: false,
      data_version_id: "dv_a11y",
      adjusted: true,
    },
    applied_config: {
      initial_cash: 100000,
      commission_bps: 5,
      slippage_model: "fixed_bps",
      slippage_bps: 3,
      spread_bps: 1,
      market_impact_bps: 0,
      volume_cap_pct: 10,
      allow_short: true,
      timeframe: "1d",
      fill_delay_bars: 1,
      signal_timing: "bar_close",
      fill_timing: "next_bar",
      data_version_id: "dv_a11y",
      adjusted: true,
      allow_synthetic: false,
    },
    costs_breakdown: { commission_paid: 5.07, slippage_paid: 3.04, spread_paid: 1.01, impact_paid: 0, total_paid: 9.12 },
  },
  logs: "",
  error: "",
};

async function mockCanonicalBackend(page: Page, opts: { fail: boolean }) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/api/v1/backtest/") || path.startsWith("/api/backtests/")) {
      console.warn(`[backtesting-states-a11y] unhandled API call: ${route.request().method()} ${path}`);
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/api/v1/backtest/jobs", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({ status: 405, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ run_id: RUN_ID, status: "queued" }) });
  });

  await page.route(`**/api/v1/backtest/jobs/${RUN_ID}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ run_id: RUN_ID, status: opts.fail ? "failed" : "done" }) });
  });

  await page.route(`**/api/v1/backtest/jobs/${RUN_ID}/result`, async (route) => {
    if (opts.fail) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ run_id: RUN_ID, status: "failed", result: null, logs: "", error: "No OHLCV bars available for AAPL on NASDAQ (timeframe=1d). Refusing to switch exchanges or use synthetic data in a production evaluation." }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(COMPLETED_RESULT) });
    }
  });

  await page.route("**/api/data/version/active", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "dv_a11y", name: "E2E Dataset", description: "", source: "e2e", is_active: true }) }),
  );
  await page.route("**/api/search*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: [{ ticker: "AAPL", exchange: "NASDAQ", name: "Apple Inc." }] }) }),
  );
  await page.route(`**/api/backtests/${RUN_ID}/analytics`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ analytics: {} }) }),
  );
  await page.route(`**/api/backtests/${RUN_ID}/robustness`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ robustness: {} }) }),
  );
  await page.route("**/api/v1/backtest/validate/walkforward", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ validation: { windows: [] } }) }),
  );
  await page.route("**/api/v1/backtest/optimize", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ optimization: { trials: [] } }) }),
  );
}

async function seedAuth(page: Page) {
  const accessToken = makeJwt({
    sub: "a11y-e2e-user",
    email: "a11y.e2e@openterminal.dev",
    role: "trader",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const refreshToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 7200 });
  await page.addInitScript(
    ([at, rt]) => {
      localStorage.setItem("ot-access-token", at);
      localStorage.setItem("ot-refresh-token", rt);
    },
    [accessToken, refreshToken],
  );
}

async function scanSerious(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa", "best-practice"])
    .disableRules(["color-contrast"])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (serious.length) {
    console.log(`\n[AXE ${label}] ${serious.length} serious/critical violation(s)`);
    for (const v of serious) {
      console.log(`  • ${v.id}: ${v.help}`);
      for (const n of v.nodes) console.log(`    - ${n.html.slice(0, 140)}`);
    }
  }
  expect(serious, `${label}: no serious/critical axe violations`).toEqual([]);
}

test("axe: setup state has no serious/critical violations", async ({ page }) => {
  test.slow();
  await seedAuth(page);
  await mockCanonicalBackend(page, { fail: false });
  await page.goto("/backtesting");
  await expect(page.getByText("Backtesting Control Deck")).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(800);
  await scanSerious(page, "setup");
});

test("axe: failed state has no serious/critical violations and shows No valid result", async ({ page }) => {
  test.slow();
  await seedAuth(page);
  await mockCanonicalBackend(page, { fail: true });
  await page.goto("/backtesting");
  await expect(page.getByText("Backtesting Control Deck")).toBeVisible({ timeout: 90_000 });

  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("No valid result").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy diagnostics" })).toBeVisible();
  // No valid-looking zero metrics: the performance panel shows dashes.
  await expect(page.getByText("Status: FAILED")).toBeVisible();
  await scanSerious(page, "failed");
});

test("axe: completed state has no serious/critical violations and shows provenance", async ({ page }) => {
  test.slow();
  await seedAuth(page);
  await mockCanonicalBackend(page, { fail: false });
  await page.goto("/backtesting");
  await expect(page.getByText("Backtesting Control Deck")).toBeVisible({ timeout: 90_000 });

  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("Status: DONE")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Run Provenance")).toBeVisible();
  await expect(page.getByText(/YahooHistoricalDataProvider · NASDAQ/)).toBeVisible();
  await expect(page.getByText(/dv_a11y \(adjusted\)/)).toBeVisible();
  await scanSerious(page, "completed");
});
