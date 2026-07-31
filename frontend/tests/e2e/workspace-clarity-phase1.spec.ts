import { expect, test } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: import("@playwright/test").Page) {
  const accessToken = makeJwt({
    sub: "workspace-clarity-user",
    email: "workspace.clarity@example.com",
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
}

test.describe("workspace clarity phase 1", () => {
  test("desktop switcher applies Quant with visible desk changes and confirmation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedAuth(page);
    await waitHome(page);

    await expect(page.getByTestId("workspace-preset-selector")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("active-workspace-badge")).toHaveText(/Trader workspace/i);
    await expect(page.getByTestId("home-primary-action")).toHaveText(/Open Workstation/i);
    await expect(page.getByTestId("home-pinned-tools")).toContainText("Watchlist");

    await page.getByTestId("workspace-preset-selector").click();
    await expect(page.getByTestId("workspace-preset-panel")).toBeVisible();
    await page.getByTestId("workspace-apply-quant").click();

    await expect(page.getByTestId("workspace-preset-announcement")).toContainText(/Switched to Quant workspace/i);
    await expect(page.getByText(/Workspace updated/i)).toBeVisible();
    await expect(page.getByTestId("active-workspace-badge")).toHaveText(/Quant workspace/i);
    await expect(page.getByRole("heading", { name: /Quant Research/i })).toBeVisible();
    await expect(page.getByTestId("home-primary-action")).toHaveText(/Run Backtest/i);
    await expect(page.getByTestId("home-pinned-tools")).toContainText("Screener");
    await expect(page.getByTestId("home-pinned-tools")).toContainText("Backtest");
    await expect(page.getByTestId("workspace-preset-selector")).toHaveText(/Quant workspace/i);
  });

  test("Apply and open Quant Research navigates to landing route", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await seedAuth(page);
    await waitHome(page);

    await page.getByTestId("workspace-preset-selector").click({ timeout: 20_000 });
    await page.getByTestId("workspace-apply-open-quant").click();

    await expect(page).toHaveURL(/\/backtesting/);
    await expect(page.getByTestId("workspace-preset-selector")).toHaveText(/Quant workspace/i);
  });

  test("mobile sheet exposes Apply and open without page-tab behavior", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAuth(page);
    await waitHome(page);

    const trigger = page.getByTestId("workspace-preset-trigger");
    await expect(trigger).toBeVisible({ timeout: 20_000 });
    await expect(trigger).toHaveText(/Trader workspace/i);
    await trigger.click();

    const sheet = page.getByTestId("workspace-preset-sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(/not separate pages/i)).toBeVisible();
    await expect(sheet.getByTestId("workspace-apply-open-quant")).toBeVisible();
    await sheet.getByTestId("workspace-apply-quant").click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId("active-workspace-badge-mobile")).toHaveText(/Quant workspace/i);
    await expect(page.getByTestId("home-primary-action-mobile")).toHaveText(/Run Backtest/i);
  });

  test("first-use onboarding maps Research choice to Quant", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const accessToken = makeJwt({
      sub: "onboard-user",
      email: "onboard@example.com",
      role: "trader",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const refreshToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 7200 });
    await page.addInitScript(
      ([at, rt]) => {
        localStorage.setItem("ot-access-token", at);
        localStorage.setItem("ot-refresh-token", rt);
        localStorage.removeItem("ot:workspace:onboarding:v1");
        localStorage.setItem("ot:workspace:preset:v1", JSON.stringify("trader"));
      },
      [accessToken, refreshToken],
    );

    await waitHome(page);
    const dialog = page.getByTestId("workspace-onboarding-dialog");
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("workspace-onboarding-research").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("active-workspace-badge")).toHaveText(/Quant workspace/i);
  });
});
