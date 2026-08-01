/**
 * Phase 6 — Desktop five-hub navigation + Settings & Admin grouping.
 */
import { expect, test } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: import("@playwright/test").Page) {
  const accessToken = makeJwt({
    sub: "phase6-hubs-user",
    email: "phase6.hubs@openterminal.dev",
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
      if (sessionStorage.getItem("ot:e2e:phase6-seeded") === "1") return;
      sessionStorage.setItem("ot:e2e:phase6-seeded", "1");
      localStorage.setItem(
        "ui-settings",
        JSON.stringify({
          state: {
            shellChromeMode: "full",
            selectedMarket: "NASDAQ",
            displayCurrency: "USD",
          },
          version: 1,
        }),
      );
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

test.describe("desktop hubs + settings admin phase 6", () => {
  test("icon rail shows five hubs and More opens Settings & Admin", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedAuth(page);
    await waitHome(page);

    await expect(page.getByTestId("icon-rail")).toBeVisible({ timeout: 20_000 });
    for (const hub of ["home", "markets", "trade", "research", "portfolio"]) {
      await expect(page.getByTestId(`icon-rail-${hub}`)).toBeVisible();
    }
    await expect(page.getByTestId("icon-rail-more")).toBeVisible();
    await expect(page.getByTestId("icon-rail-settings")).toHaveCount(0);

    await page.getByTestId("icon-rail-research").click();
    await expect(page).toHaveURL(/\/equity\/research-desk/);
    await expect(page.getByTestId("icon-rail-research")).toHaveAttribute("data-active", "true");

    await page.getByTestId("icon-rail-more").click();
    await expect(page.getByTestId("icon-rail-more-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings & Admin" })).toBeVisible();
    await page.getByRole("link", { name: "Data quality" }).click();
    await expect(page).toHaveURL(/\/equity\/data-quality/);
  });

  test("Settings page lists admin destinations", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await seedAuth(page);
    await page.goto("/equity/settings", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("settings-admin-panel")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("settings-admin-appearance")).toBeVisible();
    await expect(page.getByTestId("settings-admin-data-quality")).toBeVisible();
    await expect(page.getByTestId("settings-admin-order-management")).toBeVisible();
    await expect(page.getByTestId("settings-admin-plugins")).toBeVisible();
    await expect(page.getByTestId("settings-admin-account")).toBeVisible();
  });

  test("mobile More keeps Settings & Admin grouping", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAuth(page);
    await waitHome(page);

    await page.getByTestId("mobile-hub-more").click();
    await expect(page.getByTestId("mobile-more-sheet")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings & Admin" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Order management" })).toBeVisible();
  });
});
