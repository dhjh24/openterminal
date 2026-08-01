/**
 * Phase 8 — Dedicated hub landing pages for Markets / Trade / Research / Portfolio.
 */
import { expect, test } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: import("@playwright/test").Page) {
  const accessToken = makeJwt({
    sub: "phase8-hubs-user",
    email: "phase8.hubs@openterminal.dev",
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
      if (sessionStorage.getItem("ot:e2e:phase8-seeded") === "1") return;
      sessionStorage.setItem("ot:e2e:phase8-seeded", "1");
      localStorage.setItem(
        "ui-settings",
        JSON.stringify({
          state: { shellChromeMode: "full", selectedMarket: "NASDAQ", displayCurrency: "USD" },
          version: 1,
        }),
      );
    },
    [accessToken, refreshToken],
  );
}

test.describe("hub landing pages phase 8", () => {
  test("desktop hubs open landing pages then primary leaf tools", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedAuth(page);
    await page.goto("/home", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("icon-rail")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("icon-rail-markets").click();
    await expect(page).toHaveURL(/\/equity\/markets/);
    await expect(page.getByTestId("hub-landing-markets")).toBeVisible();
    await page.getByTestId("hub-primary-markets").click();
    await expect(page).toHaveURL(/\/equity\/stocks/);
    await expect(page.getByTestId("icon-rail-markets")).toHaveAttribute("data-active", "true");

    await page.getByTestId("icon-rail-trade").click();
    await expect(page).toHaveURL(/\/equity\/trade/);
    await expect(page.getByTestId("hub-landing-trade")).toBeVisible();
    await page.getByTestId("hub-primary-trade").click();
    await expect(page).toHaveURL(/\/equity\/chart-workstation/);

    await page.getByTestId("icon-rail-research").click();
    await expect(page).toHaveURL(/\/equity\/research-desk/);
    await expect(page.getByTestId("hub-landing-research")).toBeVisible();

    await page.getByTestId("icon-rail-portfolio").click();
    await expect(page).toHaveURL(/\/equity\/portfolio-desk/);
    await expect(page.getByTestId("hub-landing-portfolio")).toBeVisible();
  });

  test("mobile Markets hub opens landing page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAuth(page);
    await page.goto("/home", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("mobile-hub-markets")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("mobile-hub-markets").click();
    await expect(page).toHaveURL(/\/equity\/markets/);
    await expect(page.getByTestId("hub-landing-markets")).toBeVisible();
    await expect(page.getByTestId("mobile-hub-markets")).toHaveAttribute("data-active", "true");
  });
});
