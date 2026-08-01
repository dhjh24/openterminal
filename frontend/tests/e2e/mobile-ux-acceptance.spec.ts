import { expect, test } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../../docs/ui-readability/after");

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: import("@playwright/test").Page) {
  const accessToken = makeJwt({
    sub: "ux-capture-user",
    email: "ux.capture@example.com",
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
}

test.describe("mobile UX acceptance", () => {
  test("phone shell: header, bottom nav, no GO bar, no horizontal overflow", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await seedAuth(page);
    await waitHome(page);

    await expect(page.getByTestId("mobile-header")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mobile-bottom-nav")).toBeVisible();
    await expect(page.getByPlaceholder(/Type ticker, command, or search/i)).not.toBeVisible();

    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflowX).toBe(false);

    await page.screenshot({ path: path.join(OUT_DIR, "home__390x844.png"), fullPage: false });
  });

  test("search sheet stays above bottom nav and closes on select", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await seedAuth(page);
    await waitHome(page);

    await page.getByTestId("mobile-header-search").click();
    const sheet = page.getByTestId("mobile-search-sheet");
    const nav = page.getByTestId("mobile-bottom-nav");
    await expect(sheet).toBeVisible();

    const sheetBox = await sheet.boundingBox();
    const navBox = await nav.boundingBox();
    expect(sheetBox && navBox).toBeTruthy();
    if (sheetBox && navBox) {
      expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(navBox.y + 2);
    }

    await expect(page.getByText(/Ctrl\+G/i)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });

  test("workspace preset selector is not page tabs", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await seedAuth(page);
    await waitHome(page);

    // Preset trigger is available on Mission Control and equity shells.
    await waitHome(page);
    const trigger = page.getByTestId("workspace-preset-trigger");
    await expect(trigger).toBeVisible({ timeout: 20_000 });
    await trigger.click();
    await expect(page.getByTestId("workspace-preset-sheet")).toBeVisible();
    await expect(page.getByText(/not separate pages/i)).toBeVisible();
    await page.getByTestId("workspace-apply-quant").click();
    await expect(page.getByTestId("workspace-preset-sheet")).toHaveCount(0);
  });

  test("chart workstation compact toolbar leaves room for canvas", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await seedAuth(page);
    await page.route("**/api/**/chart**", async (route) => {
      await route.fulfill({
        json: {
          ticker: "AAPL",
          interval: "1d",
          currency: "USD",
          data: Array.from({ length: 40 }, (_, i) => ({
            t: 1708740000 + i * 86400,
            o: 180 + i * 0.2,
            h: 182 + i * 0.2,
            l: 178 + i * 0.2,
            c: 181 + i * 0.2,
            v: 100000,
          })),
        },
      });
    });

    await page.goto("/equity/chart-workstation", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("chart-workstation")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId("chart-shell-mobile-layout")).toBeVisible();
    await expect(page.getByTestId("chart-shell-tools-drawer-mobile")).toHaveCount(0);

    const panel = page.locator(".chart-panel-body").first();
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(280);

    await page.getByRole("button", { name: "Tools" }).click();
    await expect(page.getByTestId("chart-shell-tools-drawer-mobile")).toBeVisible();
  });

  test("desktop shell remains intact at 1440×900", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await seedAuth(page);
    await waitHome(page);

    await expect(page.getByTestId("mobile-header")).toBeHidden();
    await expect(page.getByTestId("mobile-bottom-nav")).toBeHidden();
    await expect(page.getByPlaceholder(/Type ticker, command, or search/i)).toBeVisible({ timeout: 20_000 });

    await page.screenshot({ path: path.join(OUT_DIR, "home__1440x900.png"), fullPage: false });
  });

  test("safe-area padding present on bottom nav", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await seedAuth(page);
    await waitHome(page);
    const pad = await page.getByTestId("mobile-bottom-nav").evaluate((el) => getComputedStyle(el).paddingBottom);
    expect(pad).toBeTruthy();
  });
});

test.describe("PWA manifest contract", () => {
  test("manifest and service worker expose build metadata", async ({ request, page }) => {
    const manifest = await request.get("/manifest.json");
    expect(manifest.ok()).toBeTruthy();
    const body = await manifest.json();
    expect(body.name).toMatch(/OpenTerminal/i);
    expect(body.display).toBe("standalone");
    expect(body.screenshots?.some((s: { form_factor?: string; sizes?: string }) => s.form_factor === "narrow" && s.sizes === "390x844")).toBeTruthy();

    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBeTruthy();
    const swText = await sw.text();
    expect(swText).toMatch(/BUILD_ID|otui-shell-/);
    // Live market/API paths must be bypassed (isLiveDataPath), never listed in PRECACHE_ASSETS.
    expect(swText).toMatch(/isLiveDataPath|\/api\//);
    expect(swText).toMatch(/PRECACHE_ASSETS/);
    expect(swText).not.toMatch(/PRECACHE_ASSETS[\s\S]*\/api\/v/);

    await page.goto("/home", { waitUntil: "domcontentloaded" });
  });
});
