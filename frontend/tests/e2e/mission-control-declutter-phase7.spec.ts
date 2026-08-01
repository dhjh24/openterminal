/**
 * Phase 7 — Mission Control declutter: secondary desk details collapsed by default.
 */
import { expect, test } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: import("@playwright/test").Page) {
  const accessToken = makeJwt({
    sub: "phase7-declutter-user",
    email: "phase7.declutter@openterminal.dev",
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
      if (sessionStorage.getItem("ot:e2e:phase7-seeded") === "1") return;
      sessionStorage.setItem("ot:e2e:phase7-seeded", "1");
      localStorage.removeItem("ot:home:desk-details:v1");
    },
    [accessToken, refreshToken],
  );
}

async function waitHome(page: import("@playwright/test").Page) {
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  await page
    .getByText(/(?:Restoring|Loading) workspace/i)
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => {});
}

test.describe("mission control declutter phase 7", () => {
  test("priority sections show without secondary desk details", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedAuth(page);
    await waitHome(page);

    await expect(page.getByTestId("market-now")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("your-desk")).toBeVisible();
    await expect(page.getByTestId("action-queue")).toBeVisible();
    await expect(page.getByTestId("portfolio-snapshot")).toBeVisible();
    await expect(page.getByTestId("explore-all-tools")).toBeVisible();
    await expect(page.getByTestId("home-desk-details-toggle")).toBeVisible();
    await expect(page.getByTestId("home-desk-details")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Portfolio HQ" })).toHaveCount(0);

    await page.getByTestId("home-desk-details-button").click();
    await expect(page.getByTestId("home-desk-details")).toBeVisible();
    await expect(page.getByRole("region", { name: "Portfolio HQ" })).toBeVisible();
    await expect(page.getByTestId("home-desk-details-button")).toHaveAttribute("aria-expanded", "true");
  });

  test("desk details preference persists across reload", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await seedAuth(page);
    await waitHome(page);

    const toggle = page.getByTestId("home-desk-details-button");
    await expect(toggle).toBeVisible({ timeout: 20_000 });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click({ force: true });
    await expect(page.getByTestId("home-desk-details")).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .getByText(/(?:Restoring|Loading) workspace/i)
      .waitFor({ state: "hidden", timeout: 15_000 })
      .catch(() => {});
    await expect(page.getByTestId("home-desk-details")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("home-desk-details-button")).toHaveAttribute("aria-expanded", "true");
  });
});
