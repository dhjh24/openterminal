/**
 * Issue #27 — options contract selection → paper buy call.
 */
import { expect, test } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

test.describe("Issue #27 options paper buy flow", () => {
  test("select call → preview → confirm paper buy", async ({ page }) => {
    const accessToken = makeJwt({
      sub: "e2e-user",
      email: "e2e@example.com",
      role: "trader",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    await page.addInitScript((token) => {
      localStorage.setItem("ot-access-token", token as string);
      localStorage.setItem("ot-refresh-token", token as string);
    }, accessToken);

    await page.route("**/api/fno/expiries**", async (route) => {
      await route.fulfill({
        json: { symbol: "AAPL", expiries: ["2025-08-15"] },
      });
    });
    await page.route("**/api/fno/summary**", async (route) => {
      await route.fulfill({
        json: {
          symbol: "AAPL",
          expiry_date: "2025-08-15",
          spot_price: 150,
          atm_strike: 150,
          atm_iv: 22,
          pcr: { pcr_oi: 1, pcr_volume: 1, pcr_oi_change: 0, signal: "neutral" },
          max_pain: 150,
          support_resistance: { support: [], resistance: [] },
        },
      });
    });
    await page.route("**/api/fno/chain/**", async (route) => {
      await route.fulfill({
        json: {
          symbol: "AAPL",
          expiry_date: "2025-08-15",
          spot_price: 150,
          atm_strike: 150,
          timestamp: new Date().toISOString(),
          available_expiries: ["2025-08-15"],
          strikes: [
            {
              strike_price: 150,
              ce: {
                oi: 1000,
                oi_change: 10,
                volume: 200,
                iv: 22,
                ltp: 3.2,
                bid: 3.1,
                ask: 3.3,
                greeks: { delta: 0.45, gamma: 0.02, theta: -0.05, vega: 0.1, rho: 0.01 },
                contract_symbol: "AAPL250815C00150000",
              },
              pe: {
                oi: 900,
                oi_change: -5,
                volume: 180,
                iv: 24,
                ltp: 2.8,
                bid: 2.7,
                ask: 2.9,
                greeks: { delta: -0.4, gamma: 0.02, theta: -0.04, vega: 0.1, rho: -0.01 },
              },
            },
          ],
          totals: {
            ce_oi_total: 1000,
            pe_oi_total: 900,
            ce_volume_total: 200,
            pe_volume_total: 180,
            pcr_oi: 0.9,
            pcr_volume: 0.9,
          },
        },
      });
    });
    await page.route("**/api/paper/portfolios", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { items: [{ id: "pf-1", name: "Demo", initial_capital: 100000, current_cash: 100000 }] } });
        return;
      }
      await route.fulfill({ json: { id: "pf-1", name: "Demo", initial_capital: 100000, current_cash: 100000 } });
    });
    await page.route("**/api/paper/orders", async (route) => {
      await route.fulfill({
        json: { id: "ord-1", status: "filled", symbol: "NASDAQ:AAPL250815C00150000", fill_price: 3.3 },
      });
    });
    await page.route("**/api/paper/portfolios/*/positions", async (route) => {
      await route.fulfill({
        json: {
          items: [
            {
              id: "pos-1",
              symbol: "NASDAQ:AAPL250815C00150000",
              quantity: 1,
              avg_entry_price: 3.3,
              side: "long",
            },
          ],
        },
      });
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/fno?symbol=AAPL", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("option-chain-table")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("option-select-CE-150").click();
    await expect(page.getByTestId("paper-option-ticket")).toBeVisible();
    await expect(page.getByTestId("paper-option-debit")).toContainText(/330/);
    await page.getByTestId("paper-option-preview").click();
    await page.getByTestId("paper-option-confirm").click();
    await expect(page.getByTestId("paper-option-success")).toBeVisible({ timeout: 15_000 });
  });
});
