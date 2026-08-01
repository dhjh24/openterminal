import { expect, test } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: import("@playwright/test").Page) {
  const accessToken = makeJwt({
    sub: "mission-control-user",
    email: "mission.control@example.com",
    role: "trader",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const refreshToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 7200 });
  await page.addInitScript(
    ([at, rt]) => {
      localStorage.setItem("ot-access-token", at);
      localStorage.setItem("ot-refresh-token", rt);
      localStorage.setItem("ot:workspace:onboarding:v1", "1");
      localStorage.setItem("ot:workspace:preset:v1", JSON.stringify("trader"));
    },
    [accessToken, refreshToken],
  );
}

async function waitHome(page: import("@playwright/test").Page) {
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  await page.getByText(/(?:Restoring|Loading) workspace/i).waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  await expect(page.getByTestId("market-now")).toBeVisible({ timeout: 20_000 });
}

test.describe("mission control hierarchy phase 2", () => {
  test("first viewport shows priority sections without launch matrix", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await seedAuth(page);
    await waitHome(page);

    await expect(page.getByTestId("market-now")).toBeVisible();
    await expect(page.getByTestId("your-desk")).toBeVisible();
    await expect(page.getByTestId("action-queue")).toBeVisible();
    await expect(page.getByTestId("portfolio-snapshot")).toBeVisible();
    await expect(page.getByTestId("explore-all-tools")).toBeVisible();
    await expect(page.getByTestId("home-primary-action")).toBeVisible();
    await expect(page.getByRole("region", { name: "Launch Matrix" })).toHaveCount(0);

    const primaryActions = page.getByTestId("home-primary-actions").locator("button");
    await expect(primaryActions).toHaveCount(2);
  });

  test("Explore all tools opens launcher and keeps advanced routes reachable", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedAuth(page);
    await waitHome(page);

    await page.getByTestId("explore-all-tools-cta").click();
    await expect(page.getByTestId("explore-all-tools-dialog")).toBeVisible();
    await expect(page.getByTestId("explore-all-tools-body")).toBeVisible();
    await page.getByRole("button", { name: /Workstation\. Chart analysis workstation/i }).click();
    await expect(page).toHaveURL(/\/equity\/chart-workstation/);
  });

  test("mobile home keeps primary action and explore within first screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAuth(page);
    await waitHome(page);

    await expect(page.getByTestId("home-primary-action-mobile")).toBeVisible();
    await expect(page.getByTestId("explore-all-tools-open-mobile")).toBeVisible();
    await expect(page.getByTestId("portfolio-snapshot")).toBeVisible();
    await page.getByTestId("explore-all-tools-open-mobile").click();
    await expect(page.getByTestId("explore-all-tools-sheet")).toBeVisible();
  });

  test("opening a desk tool records a recent screen", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await seedAuth(page);
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.removeItem("ot:home:recent-tools:v1"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(/(?:Restoring|Loading) workspace/i).waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
    await expect(page.getByTestId("market-now")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("your-desk-pinned").getByRole("button", { name: /^Watchlist$/i }).click();
    await expect(page).toHaveURL(/\/equity\/watchlist/);
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem("ot:home:recent-tools:v1")))
      .toContain("Watchlist");
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("your-desk-recent")).toContainText(/Watchlist/i, { timeout: 20_000 });
  });
});
