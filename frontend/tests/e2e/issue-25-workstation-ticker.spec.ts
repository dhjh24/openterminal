/**
 * Issue #25 — header ticker loads active workstation pane; feed language + overlay stack.
 */
import { expect, test, type Page } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: Page) {
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
      localStorage.removeItem("ot_chart_workstation");
      localStorage.setItem(
        "ot:workspace:preset:v1",
        JSON.stringify("trader"),
      );
    },
    [accessToken, refreshToken],
  );
}

async function mockChartApis(page: Page) {
  const sampleData = [
    { t: 1708740000, o: 180, h: 185, l: 179, c: 184, v: 100000 },
    { t: 1708743600, o: 184, h: 188, l: 183, c: 187, v: 120000 },
    { t: 1708747200, o: 187, h: 190, l: 185, c: 189, v: 90000 },
  ];
  const chartResponse = { ticker: "AAPL", interval: "1d", currency: "USD", data: sampleData };
  await page.route("**/api/v3/chart/**", async (route) => {
    await route.fulfill({ json: chartResponse });
  });
  await page.route("**/api/chart/**", async (route) => {
    await route.fulfill({ json: chartResponse });
  });
  await page.route("**/api/search**", async (route) => {
    await route.fulfill({
      json: {
        results: [{ ticker: "AAPL", name: "Apple Inc.", country_code: "US", exchange: "NASDAQ" }],
      },
    });
  });
  await page.route("**/api/charts/batch**", async (route) => {
    await route.fulfill({
      json: {
        results: [
          {
            ticker: "AAPL",
            interval: "1d",
            currency: "USD",
            data: sampleData,
          },
        ],
      },
    });
  });
}

test.describe("Issue #25 workstation ticker + overlays", () => {
  test("demo path: Open Workstation → header Load AAPL → visible chart", async ({ page }) => {
    test.slow();
    await seedAuth(page);
    await mockChartApis(page);

    await page.goto("/home", { waitUntil: "domcontentloaded" });
    const openWorkstation = page.getByRole("link", { name: /Open Workstation/i }).or(
      page.getByRole("button", { name: /Open Workstation/i }),
    );
    if (await openWorkstation.count()) {
      await openWorkstation.first().click();
    } else {
      await page.goto("/equity/chart-workstation", { waitUntil: "domcontentloaded" });
    }

    const workstation = page.getByTestId("chart-workstation");
    await expect(workstation).toBeVisible({ timeout: 90_000 });

    const headerInput = page.getByTestId("topbar-ticker-input");
    await expect(headerInput).toBeVisible({ timeout: 30_000 });
    await headerInput.fill("AAPL");
    await page.getByTestId("topbar-ticker-load").click();

    await expect(page.getByTestId("chart-shell-active-pane")).toContainText(/AAPL/i, { timeout: 30_000 });
    const pane = page.locator('[data-testid^="chart-panel-"]').first();
    await expect(pane).toBeVisible();
    await expect(page.getByTestId("ticker-search-input").first()).toHaveValue(/AAPL/i, { timeout: 30_000 });
  });

  test("overlay stack keeps agent and notices above mobile nav on phone", async ({ page }) => {
    await seedAuth(page);
    await mockChartApis(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/equity/chart-workstation", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("chart-workstation")).toBeVisible({ timeout: 90_000 });

    const stack = page.getByTestId("overlay-stack");
    await expect(stack).toBeVisible();
    const stackBox = await stack.boundingBox();
    expect(stackBox).toBeTruthy();
    if (stackBox) {
      // Stack must sit above the ~60px mobile bottom nav region.
      expect(stackBox.y + stackBox.height).toBeLessThan(844 - 48);
    }

    // Floating agent is intentionally hidden on phone (More menu owns Agent).
    await expect(page.getByTestId("agent-launcher")).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId("agent-launcher")).toBeVisible({ timeout: 15_000 });
    const agentBox = await page.getByTestId("agent-launcher").boundingBox();
    const chartBox = await page.getByTestId("chart-grid").boundingBox();
    expect(agentBox && chartBox).toBeTruthy();
    if (agentBox && chartBox) {
      // Agent sits in the overlay stack (bottom-right), not over the chart body center.
      expect(agentBox.x).toBeGreaterThan(chartBox.x + chartBox.width * 0.45);
      expect(agentBox.y).toBeGreaterThan(chartBox.y + chartBox.height * 0.35);
    }
  });
});
