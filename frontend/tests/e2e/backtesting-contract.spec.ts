import { expect, test, type Page } from "@playwright/test";

/**
 * Issue #32 Phase 1 — canonical backtest API contract.
 * Drives the real Backtesting UI: clicks Run, lets it poll the canonical
 * /api/v1/backtest/jobs* endpoints, and verifies a completed result with a
 * non-empty run ID. Also asserts the submitted job carries the visible
 * execution settings (symbol, market, timeframe).
 */

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

const RUN_ID = "bt_e2e_phase1";

const RESULT_PAYLOAD = {
  run_id: RUN_ID,
  status: "done",
  result: {
    asset: "AAPL",
    symbol: "AAPL",
    bars: 3,
    initial_cash: 100000,
    final_equity: 123456.78,
    pnl_amount: 23456.78,
    ending_cash: 23456.78,
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
  },
  logs: "",
  error: "",
};

async function mockCanonicalBackend(page: Page): Promise<{ submitBody: () => Record<string, unknown> | null }> {
  let capturedBody: Record<string, unknown> | null = null;
  let statusPolls = 0;

  // Catch-all registered FIRST; more specific routes registered after win.
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.startsWith("/api/v1/backtest/") || path.startsWith("/api/backtests/")) {
      console.warn(`[backtesting-contract] unhandled API call: ${route.request().method()} ${path}`);
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/api/v1/backtest/jobs", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fulfill({ status: 405, contentType: "application/json", body: "{}" });
      return;
    }
    capturedBody = (route.request().postDataJSON() as Record<string, unknown>) ?? null;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ run_id: RUN_ID, status: "queued" }) });
  });

  await page.route(`**/api/v1/backtest/jobs/${RUN_ID}`, async (route) => {
    statusPolls += 1;
    const status = statusPolls >= 2 ? "done" : "running";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ run_id: RUN_ID, status }) });
  });

  await page.route(`**/api/v1/backtest/jobs/${RUN_ID}/result`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RESULT_PAYLOAD) });
  });

  await page.route("**/api/data/version/active", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "dv_e2e_phase1", name: "E2E Dataset", description: "", source: "e2e", active: true }),
    }),
  );

  await page.route("**/api/search*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [{ ticker: "AAPL", exchange: "NASDAQ", name: "Apple Inc." }] }),
    }),
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

  return { submitBody: () => capturedBody };
}

test("canonical job contract: Run submits, polls, and completes with a run ID", async ({ page }) => {
  test.slow();
  const accessToken = makeJwt({
    sub: "e2e-user",
    email: "e2e@example.com",
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

  const { submitBody } = await mockCanonicalBackend(page);

  await page.goto("/backtesting");
  await expect(page.getByText("Backtesting Control Deck")).toBeVisible({ timeout: 90_000 });

  // Default run state: AAPL / NASDAQ / daily / $100k.
  const runButton = page.getByRole("button", { name: "Run", exact: true });
  await expect(runButton).toBeEnabled({ timeout: 30_000 });
  await runButton.click();

  // Submit went through the canonical contract with the visible settings.
  await expect(page.getByText(/Run ID: bt_e2e_phase1/)).toBeVisible({ timeout: 30_000 });
  const body = submitBody();
  expect(body).not.toBeNull();
  expect(body?.symbol).toBe("AAPL");
  expect(body?.market).toBe("NASDAQ");
  expect(body?.timeframe).toBe("1d");
  expect(body?.strategy).toMatch(/^example:/);

  // Polling completed: status flips to DONE and the result is rendered.
  await expect(page.getByText("Status: DONE")).toBeVisible({ timeout: 60_000 });

  // Result data renders in the equity curve panel (no empty state).
  const vizPanel = page
    .locator("section")
    .filter({ has: page.locator(".ot-type-panel-title", { hasText: "Backtest Visualizations" }) })
    .first();
  await vizPanel.getByRole("button", { name: /^Equity Curve$/ }).scrollIntoViewIfNeeded();
  await vizPanel.getByRole("button", { name: /^Equity Curve$/ }).click();
  await expect(vizPanel.locator("svg polyline").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Run a backtest to see equity curve")).not.toBeVisible();
});
