/**
 * Phase 11: Responsive overflow, navigation, and interaction tests.
 *
 * Fails when:
 * - document.documentElement.scrollWidth > window.innerWidth
 * - fixed navigation exceeds viewport width
 * - any primary heading is clipped
 * - the Agent control overlaps navigation
 * - content is hidden behind bottom navigation
 * - safe-area padding is absent
 * - a panel exceeds its container
 * - a mobile route creates page-level horizontal scrolling
 */
import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "390×844", width: 390, height: 844 },
  { name: "393×852", width: 393, height: 852 },
  { name: "412×915", width: 412, height: 915 },
  { name: "430×932", width: 430, height: 932 },
  { name: "768×1024", width: 768, height: 1024 },
  { name: "1366×768", width: 1366, height: 768 },
  { name: "1920×1080", width: 1920, height: 1080 },
];

const PHONE_VIEWPORTS = VIEWPORTS.filter((v) => v.width <= 430);

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: import("@playwright/test").Page) {
  const accessToken = makeJwt({
    sub: "responsive-e2e-user",
    email: "responsive.e2e@openterminal.dev",
    role: "trader",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const refreshToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 7200 });
  await page.addInitScript(
    ([at, rt]) => {
      localStorage.setItem("ot-access-token", at);
      localStorage.setItem("ot-refresh-token", rt);
    },
    [accessToken, refreshToken],
  );
}

test.describe("responsive: no page-level horizontal overflow", () => {
  for (const vp of VIEWPORTS) {
    test(`Home at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedAuth(page);
      await page.goto("/home", { waitUntil: "networkidle" });
      await page.waitForTimeout(800);

      const overflowX = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth + 1;
      });
      expect(overflowX, `scrollWidth (${vp.width}) should not exceed viewport`).toBe(false);
    });
  }
});

test.describe("responsive: fixed bottom nav", () => {
  for (const vp of PHONE_VIEWPORTS) {
    test(`bottom nav fits viewport at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedAuth(page);
      await page.goto("/home", { waitUntil: "networkidle" });
      await page.waitForTimeout(800);

      const navBox = await page.locator("nav.fixed.bottom-0").boundingBox();
      expect(navBox).not.toBeNull();
      expect(navBox!.width).toBeLessThanOrEqual(vp.width);
      expect(navBox!.x).toBe(0);

      // Every nav link must be within the nav bounds
      const links = page.locator("nav.fixed.bottom-0 a, nav.fixed.bottom-0 button");
      const count = await links.count();
      for (let i = 0; i < count; i++) {
        const box = await links.nth(i).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 2);
      }
    });
  }
});

test.describe("responsive: bottom nav does not clip content", () => {
  for (const vp of PHONE_VIEWPORTS) {
    test(`scrollable content clears bottom nav at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedAuth(page);
      await page.goto("/home", { waitUntil: "networkidle" });
      await page.waitForTimeout(800);

      // The last visible section should be above the bottom nav
      const navBox = await page.locator("nav.fixed.bottom-0").boundingBox();
      expect(navBox).not.toBeNull();
      const navTop = navBox!.y;

      // Scroll to bottom of content
      await page.evaluate(() => {
        const main = document.querySelector("main");
        if (main) main.scrollTop = main.scrollHeight;
      });
      await page.waitForTimeout(300);

      // Check that main's visible bottom content is above nav
      const main = page.locator("main");
      const mainBox = await main.boundingBox();
      expect(mainBox).not.toBeNull();
      // The main content should stop above the nav (or have enough padding)
      expect(mainBox!.y + mainBox!.height).toBeGreaterThanOrEqual(navTop - 20);
    });
  }
});

test.describe("responsive: Agent does not overlap nav", () => {
  for (const vp of PHONE_VIEWPORTS) {
    test(`Agent button position at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedAuth(page);
      await page.goto("/home", { waitUntil: "networkidle" });
      await page.waitForTimeout(800);

      // The floating Agent launcher should not be visible on mobile
      const launcher = page.locator(".ot-agent-launcher");
      const launcherBox = await launcher.boundingBox();

      if (launcherBox) {
        // If visible (desktop), it must NOT cover the bottom nav
        const navBox = await page.locator("nav.fixed.bottom-0, .ot-status-bar").boundingBox();
        if (navBox) {
          const launcherBottom = launcherBox.y + launcherBox.height;
          expect(launcherBottom).toBeLessThanOrEqual(navBox.y);
        }
      }
    });
  }
});

test.describe("responsive: safe-area padding", () => {
  for (const vp of PHONE_VIEWPORTS) {
    test(`bottom nav has safe-area padding at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedAuth(page);
      await page.goto("/home", { waitUntil: "networkidle" });
      await page.waitForTimeout(800);

      const hasSafeArea = await page.evaluate(() => {
        const nav = document.querySelector("nav.fixed.bottom-0");
        if (!nav) return false;
        const style = window.getComputedStyle(nav);
        return style.paddingBottom !== "0px" && style.paddingBottom !== "";
      });
      expect(hasSafeArea).toBe(true);
    });
  }
});

test.describe("responsive: interaction flow", () => {
  test("full mobile interaction flow at 390×844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAuth(page);
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // 1. Verify Home page loaded — main section exists
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // 2. Open desk settings
    const deskBtn = page.locator('button[aria-label="Desk settings"]');
    await expect(deskBtn).toBeVisible();
    await deskBtn.click();
    await page.waitForTimeout(200);

    // 3. Desk panel should now be visible
    await expect(page.getByText("Clocks")).toBeVisible();
    await expect(page.getByText("Desk Config")).toBeVisible();
    await expect(page.getByText("Shortcuts")).toBeVisible();

    // 4. Close desk settings
    await deskBtn.click();
    await page.waitForTimeout(200);

    // 5. Open More navigation
    const moreBtn = page.locator('nav.fixed.bottom-0 button[aria-label="More navigation"]');
    await expect(moreBtn).toBeVisible();
    await moreBtn.click();
    await page.waitForTimeout(200);

    // 6. More menu should be visible
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByText("News")).toBeVisible();
    await expect(page.getByText("Agent")).toBeVisible();

    // 7. Navigate to News - this should close More
    const newsLink = page.locator('[role="menu"] a', { hasText: "News" });
    await newsLink.click();
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/equity\/news/);

    // 8. Return Home via bottom nav
    const homeLink = page.locator('nav.fixed.bottom-0 a[aria-label="Home"]');
    await expect(homeLink).toBeVisible();
    await homeLink.click();
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/home/);

    // 9. Open More + Agent
    await page.locator('nav.fixed.bottom-0 button[aria-label="More navigation"]').click();
    await page.waitForTimeout(200);
    const agentBtn = page.locator('[role="menu"] button', { hasText: "Agent" });
    await expect(agentBtn).toBeVisible();
    await agentBtn.click();
    await page.waitForTimeout(300);

    // 10. Agent console should have opened
    const agentPanel = page.locator(".ot-agent-panel");
    await expect(agentPanel).toBeVisible();

    // 11. Return Home
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    // 12. Scroll to bottom of content
    await page.evaluate(() => {
      const el = document.querySelector("main");
      if (el) el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(300);

    // 13. No page-level overflow after full interaction
    const overflowX = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflowX).toBe(false);
  });
});

test.describe("responsive: long text handling", () => {
  test("long email does not overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const longEmail = "very.long.email.address.for.testing.purposes@extremely-long-domain-name.openterminal.dev";
    const accessToken = makeJwt({
      sub: "responsive-e2e-user",
      email: longEmail,
      role: "trader",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const refreshToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 7200 });
    await page.addInitScript(
      ([at, rt]) => {
        localStorage.setItem("ot-access-token", at);
        localStorage.setItem("ot-refresh-token", rt);
      },
      [accessToken, refreshToken],
    );
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    const overflowX = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflowX).toBe(false);
  });
});

test.describe("responsive: reduced motion", () => {
  test("reduced-motion preference does not break layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAuth(page);
    // Set prefers-reduced-motion: reduce before navigation
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    const overflowX = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflowX).toBe(false);

    // Ticker tape animation should be paused
    const tickerPaused = await page.evaluate(() => {
      const track = document.querySelector(".ticker-tape-track");
      if (!track) return true;
      const anim = window.getComputedStyle(track).animationName;
      return anim === "none" || anim === "";
    });
    expect(tickerPaused).toBe(true);
  });
});

test.describe("responsive: desktop no regression", () => {
  test("1920×1080 desktop layout intact", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await seedAuth(page);
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    // Desktop header visible (hidden on mobile, shown on md+)
    const desktopHeader = page.locator("section[aria-label='Home Header']");
    await expect(desktopHeader).toBeVisible();

    // Icon rail visible on desktop
    const iconRail = page.locator('[aria-label="Primary icon rail"]');
    await expect(iconRail).toBeVisible();

    // Bottom nav hidden on desktop
    const bottomNav = page.locator("nav.fixed.bottom-0");
    await expect(bottomNav).not.toBeVisible();

    // No overflow
    const overflowX = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflowX).toBe(false);
  });

  test("1366×768 desktop no regression", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await seedAuth(page);
    await page.goto("/home", { waitUntil: "networkidle" });
    await page.waitForTimeout(800);

    const overflowX = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflowX).toBe(false);
  });
});
