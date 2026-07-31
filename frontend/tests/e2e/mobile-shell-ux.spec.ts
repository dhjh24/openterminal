/**
 * Mobile shell: bottom nav, search sheet, safe-area padding, overflow, USD, PWA.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const PHONE = { width: 390, height: 844 };
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe("mobile shell UX", () => {
  test.use({ viewport: PHONE });

  test("bottom nav has five tabs and More sheet destinations", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile-chromium", "phone project only");
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("terminal-shell")).toBeVisible({ timeout: 30_000 });
    const nav = page.getByTestId("mobile-bottom-nav");
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Watch" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Stocks" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Options" })).toBeVisible();
    await nav.getByTestId("mobile-nav-more").click();
    await expect(page.getByTestId("mobile-more-sheet")).toBeVisible();
    for (const label of ["News", "Alerts", "Portfolio", "Screener", "Workstation", "Settings", "Agent"]) {
      await expect(page.getByRole("menuitem", { name: label })).toBeVisible();
    }
  });

  test("mobile header search opens sheet above bottom nav without GO button", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile-chromium", "phone project only");
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("mobile-header")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("mobile-header-search").click();
    const sheet = page.getByTestId("mobile-search-sheet");
    await expect(sheet).toBeVisible();
    await expect(page.getByTestId("mobile-search-input")).toBeVisible();
    await expect(sheet.getByText("Ctrl+G")).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: /^GO$/i })).toHaveCount(0);
    const box = await sheet.locator('[role="dialog"]').boundingBox();
    const navBox = await page.getByTestId("mobile-bottom-nav").boundingBox();
    expect(box && navBox).toBeTruthy();
    if (box && navBox) {
      expect(box.y + box.height).toBeLessThanOrEqual(navBox.y + 2);
      expect(box.height).toBeLessThanOrEqual(PHONE.height * 0.7);
    }
  });

  test("no horizontal overflow at phone width", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile-chromium", "phone project only");
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("terminal-shell")).toBeVisible({ timeout: 30_000 });
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflow).toBeFalsy();
  });

  test("content padding clears bottom nav", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile-chromium", "phone project only");
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("terminal-shell")).toBeVisible({ timeout: 30_000 });
    const pad = await page.evaluate(() => {
      const content = document.querySelector('[data-testid="terminal-shell-content"]');
      if (!content) return 0;
      return parseFloat(getComputedStyle(content).paddingBottom || "0");
    });
    expect(pad).toBeGreaterThanOrEqual(48);
  });

  test("chart workstation shows compact toolbar and chart area", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile-chromium", "phone project only");
    await page.goto("/equity/chart-workstation", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("chart-shell-mobile-layout")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("chart-shell-tools-button")).toBeVisible();
    const height = await page.locator(".chart-workstation-grid-area").evaluate((el) => el.clientHeight);
    expect(height).toBeGreaterThanOrEqual(300);
  });
});

test.describe("PWA manifest and service worker", () => {
  test("manifest references Mission Control narrow screenshot and SW uses build id", async ({ request }) => {
    const manifest = await request.get("/manifest.json");
    expect(manifest.ok()).toBeTruthy();
    const body = await manifest.json();
    expect(body.lang).toBe("en-US");
    expect(body.display).toBe("standalone");
    const narrow = (body.screenshots || []).find((s: { form_factor?: string }) => s.form_factor === "narrow");
    expect(narrow?.src).toContain("narrow-home");
    expect(narrow?.sizes).toBe("390x844");

    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBeTruthy();
    const swText = await sw.text();
    expect(swText).toMatch(/otui-shell-/);
    expect(swText).not.toMatch(/cache\.put\([^)]*\/api\//);
    expect(
      swText.includes("__OTUI_BUILD_ID__") ||
        /const BUILD_ID = "[^"]+"/.test(swText) ||
        /otui-shell-[0-9a-f]+/i.test(swText),
    ).toBeTruthy();
  });
});

test.describe("viewport overflow matrix", () => {
  const VIEWPORTS = [
    { name: "320x568", width: 320, height: 568 },
    { name: "375x667", width: 375, height: 667 },
    { name: "390x844", width: 390, height: 844 },
    { name: "430x932", width: 430, height: 932 },
  ] as const;

  for (const vp of VIEWPORTS) {
    test(`login no horizontal overflow @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/login", { waitUntil: "domcontentloaded" });
      const overflowX = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflowX).toBeFalsy();
    });
  }
});

test("capture Mission Control narrow screenshot for PWA", async ({ browser }) => {
  test.skip(test.info().project.name !== "mobile-chromium", "phone project only");
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 1,
    storageState: test.info().project.use.storageState as string | undefined,
  });
  const page = await context.newPage();
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("terminal-shell")).toBeVisible({ timeout: 30_000 });
  const out = path.resolve(__dirname, "../../public/screenshots/narrow-home.png");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, fullPage: false });
  expect(fs.existsSync(out)).toBeTruthy();
  await context.close();
});
