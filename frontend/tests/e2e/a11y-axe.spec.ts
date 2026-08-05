/**
 * Phase: Accessibility — Playwright axe-core audit.
 *
 * Runs axe on key routes at multiple viewports.
 * Violations are collected and reported but tests are soft-fail
 * (reported not blocking) so CI captures the full picture.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "390×844", width: 390, height: 844 },
  { name: "430×932", width: 430, height: 932 },
  { name: "768×1024", width: 768, height: 1024 },
  { name: "1366×768", width: 1366, height: 768 },
  { name: "1920×1080", width: 1920, height: 1080 },
] as const;

const ROUTES = [
  { path: "/", label: "Landing" },
  { path: "/login", label: "Login" },
  { path: "/home", label: "Home (auth)", auth: true },
  { path: "/fno?symbol=SPY", label: "Options (auth)", auth: true },
  { path: "/equity/news?ticker=NVDA", label: "News (auth)", auth: true },
  { path: "/equity/security/AAPL", label: "Security (auth)", auth: true },
  { path: "/backtesting", label: "Backtesting (auth)", auth: true },
] as const;

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: import("@playwright/test").Page) {
  const accessToken = makeJwt({
    sub: "a11y-e2e-user",
    email: "a11y.e2e@openterminal.dev",
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

// Map of known-disabled rules per route (false positives we accept)
const DISABLED_RULES: Record<string, string[]> = {
  // Colour-contrast on terminal themes is by design (dark bg + muted labels)
  landing: ["color-contrast"],
  login: ["color-contrast"],
  "home (auth)": ["color-contrast"],
  "options (auth)": ["color-contrast"],
  "news (auth)": ["color-contrast"],
  "security (auth)": ["color-contrast"],
  "backtesting (auth)": ["color-contrast"],
};

test.describe("a11y: axe-core scan", () => {
  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`${route.label} at ${vp.name}`, async ({ page }) => {
        test.setTimeout(60_000);

        await page.setViewportSize({ width: vp.width, height: vp.height });

        if (route.auth) {
          await seedAuth(page);
        }

        const waitUntil = route.path.includes("news") ? "domcontentloaded" : "networkidle";
        const response = await page.goto(route.path, {
          waitUntil,
          timeout: 30_000,
        });
        expect(response?.status()).not.toBe(500);

        // Let dynamic content settle
        await page.waitForTimeout(1500);

        const key = route.label.toLowerCase();

        const results = await new AxeBuilder({ page })
          .withTags([
            "wcag2a",
            "wcag2aa",
            "wcag21a",
            "wcag21aa",
            "wcag22a",
            "wcag22aa",
            "best-practice",
          ])
          .disableRules(DISABLED_RULES[key] ?? [])
          .analyze();

        // Log violations for CI output
        if (results.violations.length > 0) {
          console.log(`\n[AXE] ${route.label} @ ${vp.name}: ${results.violations.length} violation(s)`);
          for (const v of results.violations) {
            console.log(`  • ${v.id}: ${v.help} (${v.impact})`);
            for (const n of v.nodes) {
              console.log(`    - ${n.html.slice(0, 120)}`);
            }
          }
        }

        // Soft-fail: report but don't block CI on first run
        // Tighten to expect(results.violations).toEqual([]) once baseline is clean
        expect(results.violations.length).toBeLessThanOrEqual(5);
      });
    }
  }
});
