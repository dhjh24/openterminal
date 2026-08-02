/**
 * Issue #26 — desktop nav simplification + branding.
 */
import { expect, test } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: import("@playwright/test").Page) {
  const accessToken = makeJwt({
    sub: "e2e-user",
    email: "e2e@example.com",
    role: "trader",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  await page.addInitScript((token) => {
    localStorage.setItem("ot-access-token", token as string);
    localStorage.setItem("ot-refresh-token", token as string);
    localStorage.setItem("ot:workspace:onboarding:v1", "1");
    localStorage.setItem("ot:workspace:preset:v1", JSON.stringify("trader"));
  }, accessToken);
}

test.describe("Issue #26 desktop navigation + branding", () => {
  test("icon rail is the primary nav; TopBar route row is gone", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedAuth(page);
    await page.goto("/home", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("icon-rail")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("topbar-primary-nav")).toHaveCount(0);

    // Destinations remain reachable via icon rail within two actions.
    await page.getByTestId("icon-rail-markets").click();
    await expect(page).toHaveURL(/\/equity\/markets/);
    await page.getByTestId("icon-rail-trade").click();
    await expect(page).toHaveURL(/\/equity\/trade/);
  });

  test("login page points at dhjh24/openterminal and demo access keeps its label", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("button", { name: />\s*DEMO ACCESS/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /github\.com\/dhjh24\/openterminal/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Hitheshkaranth");
  });

  test("desktop home market strip does not force page overflow", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedAuth(page);
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("icon-rail")).toBeVisible({ timeout: 30_000 });

    const overflowX = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth > root.clientWidth + 2;
    });
    expect(overflowX).toBe(false);
  });
});
