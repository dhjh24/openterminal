import { expect, test } from "@playwright/test";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: import("@playwright/test").Page) {
  const accessToken = makeJwt({
    sub: "mobile-shell-e2e-user",
    email: "mobile.shell@example.com",
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

test.describe("mobile shell redesign", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await seedAuth(page);
  });

  test("home shows mobile chrome without desktop GO bar overlap", async ({ page }) => {
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.getByText(/(?:Restoring|Loading) workspace/i).waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});

    await expect(page.getByTestId("mobile-header")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();

    const commandInput = page.getByPlaceholder(/Type ticker, command, or search/i);
    await expect(commandInput).not.toBeVisible();

    const overflowX = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflowX).toBe(false);
  });

  test("search sheet opens above bottom nav", async ({ page }) => {
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.getByText(/(?:Restoring|Loading) workspace/i).waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});

    await expect(page.getByTestId("mobile-header-search")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("mobile-header-search").click();

    const sheet = page.getByTestId("mobile-search-sheet");
    const nav = page.getByTestId("mobile-bottom-nav");
    await expect(sheet).toBeVisible();

    const sheetBox = await sheet.boundingBox();
    const navBox = await nav.boundingBox();
    expect(sheetBox).not.toBeNull();
    expect(navBox).not.toBeNull();

    if (sheetBox && navBox) {
      expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(navBox.y + 2);
    }
  });

  test("chart workstation route loads on mobile", async ({ page }) => {
    await page.route("**/api/v3/chart/**", async (route) => {
      await route.fulfill({
        json: {
          ticker: "AAPL",
          interval: "1d",
          currency: "USD",
          data: [{ t: 1708740000, o: 2500, h: 2510, l: 2490, c: 2505, v: 100000 }],
        },
      });
    });
    await page.route("**/api/chart/**", async (route) => {
      await route.fulfill({
        json: {
          ticker: "AAPL",
          interval: "1d",
          currency: "USD",
          data: [{ t: 1708740000, o: 2500, h: 2510, l: 2490, c: 2505, v: 100000 }],
        },
      });
    });
    await page.route("**/api/charts/batch**", async (route) => {
      await route.fulfill({ json: {} });
    });

    await page.goto("/equity/chart-workstation", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("chart-workstation")).toBeVisible({ timeout: 90_000 });
  });

  test("login password toggle exposes show/hide labels and eye icons", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    const toggle = page.getByRole("button", { name: "Show password" });
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();

    const eyeIcons = page.locator(".ot-password-toggle svg");
    await expect(eyeIcons).toHaveCount(1);
  });
});
