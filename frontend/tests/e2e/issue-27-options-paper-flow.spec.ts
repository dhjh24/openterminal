/**
 * Issue #27 — options contract selection → paper buy call.
 * Covers the desktop flow, the compact phone chain, keyboard-only operation,
 * responsive breakpoints, 200% zoom, and an axe-core accessibility audit on
 * the chain + order ticket (contrast, naming, focus, selected state).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: Page): Promise<void> {
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
}

const CHAIN_PAYLOAD = {
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
};

async function setupPaperFlowRoutes(page: Page): Promise<void> {
  // NOTE: Playwright checks routes in reverse registration order, so the
  // generic chain route must be registered BEFORE the more specific
  // expiries / summary routes for those to take precedence.
  await page.route("**/api/fno/chain/**", async (route) => {
    await route.fulfill({ json: CHAIN_PAYLOAD });
  });
  // Specific routes registered AFTER the generic chain route so they are
  // matched first (Playwright checks routes in reverse registration order).
  await page.route("**/api/fno/chain/AAPL/expiries", async (route) => {
    await route.fulfill({ json: { symbol: "AAPL", expiries: ["2025-08-15"] } });
  });
  await page.route("**/api/fno/chain/AAPL/summary**", async (route) => {
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
        timestamp: new Date().toISOString(),
        delay_status: "realtime",
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
            mark_price: 3.3,
            unrealized_pnl: 0,
            side: "long",
          },
        ],
      },
    });
  });
}

test.describe("Issue #27 options paper buy flow", () => {
  test("select call → preview → confirm paper buy (desktop)", async ({ page }) => {
    await seedAuth(page);
    await setupPaperFlowRoutes(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/fno?symbol=AAPL", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("option-chain-table")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("option-select-CE-150").click();
    await expect(page.getByTestId("paper-option-ticket")).toBeVisible();
    await expect(page.getByTestId("paper-option-debit")).toContainText(/330/);
    await expect(page.getByTestId("option-chain-freshness")).toBeVisible();
    await page.getByTestId("paper-option-preview").click();
    await expect(page.getByTestId("paper-option-preview-dialog")).toBeVisible();
    await page.getByTestId("paper-option-confirm").click();
    await expect(page.getByTestId("paper-option-success")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("paper-option-position-summary")).toBeVisible();
  });

  test("compact phone chain renders one side at a time with 44px touch targets", async ({ page }) => {
    await seedAuth(page);
    await setupPaperFlowRoutes(page);

    // Small phone viewport: 320 CSS px wide (narrowest supported).
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/fno?symbol=AAPL", { waitUntil: "domcontentloaded" });

    // The full desktop table must not be squeezed into the phone viewport.
    await expect(page.getByTestId("option-chain-table")).toBeVisible({ timeout: 60_000 });
    const mobileCards = page.getByTestId("option-chain-mobile-cards");
    await expect(mobileCards).toBeVisible();
    await expect(page.getByTestId("option-chain-desktop-table")).toBeHidden();

    // One side at a time: a call card is visible; switch to puts.
    const callCard = page.getByTestId("option-card-CE-150");
    await expect(callCard).toBeVisible();
    // Touch target ≥ 44 × 44 CSS px.
    const box = await callCard.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await page.getByRole("tab", { name: "puts" }).click();
    await expect(page.getByTestId("option-card-PE-150")).toBeVisible();
    await expect(callCard).toHaveCount(0);

    // Selecting a card opens the paper ticket with accessible state.
    await page.getByTestId("option-card-PE-150").click();
    await expect(page.getByTestId("paper-option-ticket")).toBeVisible();
    await expect(page.getByTestId("option-card-PE-150")).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Issue #27 keyboard-only operation", () => {
  test("selects a call and previews the paper buy without a pointer", async ({ page }) => {
    await seedAuth(page);
    await setupPaperFlowRoutes(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/fno?symbol=AAPL", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("option-chain-table")).toBeVisible({ timeout: 60_000 });

    // Keyboard focus lands on the first call Last-price control; Enter selects.
    await page.getByTestId("option-select-CE-150").focus();
    await expect(page.getByTestId("option-select-CE-150")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("paper-option-ticket")).toBeVisible();
    await expect(page.getByTestId("option-select-CE-150")).toHaveAttribute("aria-pressed", "true");

    // Focus the Paper Buy Call action and open the preview with Enter.
    await page.getByTestId("paper-option-preview").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("paper-option-preview-dialog")).toBeVisible();
    // Focus moves into the dialog (confirm action), not left behind.
    await expect(page.getByTestId("paper-option-confirm")).toBeFocused();

    // Escape closes the dialog and restores focus to the invoking control.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("paper-option-preview-dialog")).toBeHidden();
    await expect(page.getByTestId("paper-option-preview")).toBeFocused();
  });

  test("space also activates contract selection", async ({ page }) => {
    await seedAuth(page);
    await setupPaperFlowRoutes(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/fno?symbol=AAPL", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("option-chain-table")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("option-select-CE-150").focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("paper-option-ticket")).toBeVisible();
    await expect(page.getByTestId("option-select-CE-150")).toHaveAttribute("aria-pressed", "true");
  });
});

// Breakpoints from the issue: 320, 375, 390, 768, 1024, 1440.
const LAYOUT_VIEWPORTS = [
  { width: 320, height: 700, mobile: true },
  { width: 375, height: 800, mobile: true },
  { width: 390, height: 844, mobile: true },
  { width: 768, height: 1024, mobile: false },
  { width: 1024, height: 768, mobile: false },
  { width: 1440, height: 900, mobile: false },
] as const;

test.describe("Issue #27 responsive layout", () => {
  for (const vp of LAYOUT_VIEWPORTS) {
    test(`chain and order ticket usable at ${vp.width}px`, async ({ page }) => {
      await seedAuth(page);
      await setupPaperFlowRoutes(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/fno?symbol=AAPL", { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("option-chain-table")).toBeVisible({ timeout: 60_000 });

      // Select a contract using whichever surface the breakpoint exposes.
      if (vp.mobile) {
        await page.getByTestId("option-card-CE-150").click();
        await expect(page.getByTestId("option-chain-desktop-table")).toBeHidden();
      } else {
        await page.getByTestId("option-select-CE-150").click();
        await expect(page.getByTestId("option-chain-mobile-cards")).toBeHidden();
      }
      await expect(page.getByTestId("paper-option-ticket")).toBeVisible();

      // The order action must be on-screen and reachable (not covered).
      await page.getByTestId("paper-option-preview").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("paper-option-preview")).toBeVisible();
      await expect(page.getByTestId("paper-option-preview")).toBeEnabled();

      // No horizontal overflow at any of the required widths.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("main flow remains usable at 200% zoom", async ({ page }) => {
    await seedAuth(page);
    await setupPaperFlowRoutes(page);
    // Real 200% zoom halves the CSS layout viewport: a 1280×800 window renders
    // at 640×400 CSS px, so the compact phone chain is the active surface.
    // (CSS `html { zoom }` does not shift Tailwind's min-width media queries in
    // Chromium, so a halved viewport is the faithful emulation.)
    await page.setViewportSize({ width: 640, height: 400 });
    await page.goto("/fno?symbol=AAPL", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("option-chain-table")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("option-card-CE-150").click();
    await expect(page.getByTestId("paper-option-ticket")).toBeVisible();
    await page.getByTestId("paper-option-preview").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("paper-option-preview")).toBeVisible();
    await expect(page.getByTestId("paper-option-preview")).toBeEnabled();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("Issue #27 accessibility audit", () => {
  test("chain, summary, and order ticket have no axe violations (contrast, naming, focus)", async ({ page }) => {
    await seedAuth(page);
    await setupPaperFlowRoutes(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/fno?symbol=AAPL", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("option-chain-summary")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("option-chain-table")).toBeVisible();
    await page.getByTestId("option-select-CE-150").click();
    await expect(page.getByTestId("paper-option-ticket")).toBeVisible();
    await page.getByTestId("paper-option-preview").click();
    await expect(page.getByTestId("paper-option-preview-dialog")).toBeVisible();
    // Let the focus trap + preview settle before scanning.
    await page.waitForTimeout(300);

    const results = await new AxeBuilder({ page })
      // Scope the audit to the components this issue changed: the summary bar
      // and the chain (which contains the table, phone cards, contract detail,
      // and the paper order ticket).
      .include('[data-testid="option-chain-summary"]')
      .include('[data-testid="option-chain-table"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      // The `region` rule flags content outside landmark regions. The app shell
      // is div-based and landmark coverage is app-wide/pre-existing (several
      // routes render their own <main>), so it is out of scope for this issue;
      // every other rule (color-contrast, aria, naming, focus, selected state)
      // is enforced strictly.
      .disableRules(["region"])
      .analyze();

    const violations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => n.html.slice(0, 160)),
    }));
    expect(violations).toEqual([]);
  });
});
