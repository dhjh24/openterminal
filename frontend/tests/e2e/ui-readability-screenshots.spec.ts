import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "..", "..", "test-results", "ui-readability");

const ROUTES: Array<{ name: string; url: string }> = [
  { name: "home-desktop", url: "/equity/dashboard" },
  { name: "watchlist-desktop", url: "/equity/watchlist" },
  { name: "settings-desktop", url: "/equity/settings" },
  { name: "fno-chain-desktop", url: "/fno" },
];

for (const route of ROUTES) {
  test(`ui readability screenshot ${route.name}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route.url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      maxDiffPixelRatio: 0.04,
      timeout: 15_000,
    });
  });
}

test("ui readability mobile dashboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/equity/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.screenshot({
    path: path.join(OUT_DIR, "dashboard-mobile.png"),
    fullPage: false,
  });
});
