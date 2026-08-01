import { expect, test } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: import("@playwright/test").Page) {
  const accessToken = makeJwt({
    sub: "mobile-nav-user",
    email: "mobile.nav@example.com",
    role: "trader",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const refreshToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 7200 });
  await page.addInitScript(
    ([at, rt]) => {
      localStorage.setItem("ot-access-token", at);
      localStorage.setItem("ot-refresh-token", rt);
      localStorage.setItem("ot:workspace:onboarding:v1", "1");
    },
    [accessToken, refreshToken],
  );
}

async function waitHome(page: import("@playwright/test").Page) {
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  await page.getByText(/(?:Restoring|Loading) workspace/i).waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible({ timeout: 20_000 });
}

test.describe("mobile navigation cleanup phase 3", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("single More entry point and hub tabs", async ({ page }) => {
    await seedAuth(page);
    await waitHome(page);

    await expect(page.getByTestId("mobile-header")).toBeVisible();
    await expect(page.getByTestId("mobile-header-more")).toHaveCount(0);
    await expect(page.getByTestId("mobile-hub-home")).toBeVisible();
    await expect(page.getByTestId("mobile-hub-markets")).toBeVisible();
    await expect(page.getByTestId("mobile-hub-trade")).toBeVisible();
    await expect(page.getByTestId("mobile-hub-portfolio")).toBeVisible();
    await expect(page.getByTestId("mobile-hub-more")).toBeVisible();
    await expect(page.getByTestId("mobile-hub-more")).toHaveCount(1);
  });

  test("nested trade route keeps Trade hub highlighted", async ({ page }) => {
    await seedAuth(page);
    await page.goto("/equity/watchlist", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("mobile-hub-trade")).toHaveAttribute("data-active", "true", { timeout: 20_000 });
    await expect(page.getByTestId("mobile-hub-home")).toHaveAttribute("data-active", "false");
  });

  test("More sheet is grouped and closes on Escape", async ({ page }) => {
    await seedAuth(page);
    await waitHome(page);

    await page.getByTestId("mobile-hub-more").click();
    const sheet = page.getByTestId("mobile-more-sheet");
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("mobile-more-sections")).toContainText("Research");
    await expect(page.getByRole("menuitem", { name: "Open Agent" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });

  test("search shows grouped results and stays above bottom nav", async ({ page }) => {
    await seedAuth(page);
    await waitHome(page);

    await page.getByTestId("mobile-header-search").click();
    const sheet = page.getByTestId("mobile-search-sheet");
    const nav = page.getByTestId("mobile-bottom-nav");
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("search-group-recent")).toBeVisible();

    await page.getByTestId("mobile-search-input").fill("chart");
    await expect(page.getByTestId("search-group-pages")).toBeVisible();
    await expect(page.getByTestId("search-group-commands")).toBeVisible();
    await expect(page.getByTestId("search-group-symbols")).toBeVisible();

    const sheetBox = await sheet.boundingBox();
    const navBox = await nav.boundingBox();
    expect(sheetBox && navBox).toBeTruthy();
    if (sheetBox && navBox) {
      expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(navBox.y + 2);
    }

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });
});
