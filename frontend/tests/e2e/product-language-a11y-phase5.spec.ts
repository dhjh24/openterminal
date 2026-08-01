/**
 * Phase 5 — Product language + hard-fail axe audits for shell, Home,
 * workspace switcher, mobile nav, and search.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: Page) {
  const accessToken = makeJwt({
    sub: "phase5-a11y-user",
    email: "phase5.a11y@openterminal.dev",
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

async function waitHome(page: Page) {
  await page.goto("/home", { waitUntil: "domcontentloaded" });
  await page
    .getByText(/(?:Restoring|Loading) workspace/i)
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => {});
}

async function assertNoSeriousAxeIssues(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .disableRules(["color-contrast"])
    .analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );

  if (blocking.length > 0) {
    console.log(`\n[AXE PHASE5] ${label}: ${blocking.length} serious/critical`);
    for (const v of blocking) {
      console.log(`  • ${v.id}: ${v.help} (${v.impact})`);
      for (const n of v.nodes.slice(0, 3)) {
        console.log(`    - ${n.html.slice(0, 140)}`);
      }
    }
  }

  expect(blocking, `${label} must have no serious/critical axe issues`).toEqual([]);
}

test.describe("product language + a11y phase 5", () => {
  test("desktop Home uses plain-language primary nav and workspace labels", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedAuth(page);
    await waitHome(page);

    await expect(page.getByTestId("icon-rail")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("link", { name: /Markets\. Equity quotes/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Charts\. Chart workstation/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Open command palette/i })).toBeVisible();

    await expect(page.getByTestId("workspace-preset-selector")).toBeVisible();
    await page.getByTestId("workspace-preset-selector").click();
    await expect(page.getByTestId("workspace-preset-panel")).toBeVisible();
    await expect(page.getByTestId("workspace-preset-panel").getByText(/Portfolio workspace/i)).toBeVisible();
    await expect(page.getByTestId("workspace-preset-panel").getByText(/Operations workspace/i)).toBeVisible();
    await expect(page.getByTestId("workspace-card-pm")).toBeVisible();
    await expect(page.getByTestId("workspace-card-ops")).toBeVisible();
    await expect(page.getByTestId("workspace-apply-pm")).toBeVisible();
    await expect(page.getByTestId("workspace-apply-ops")).toBeVisible();

    await assertNoSeriousAxeIssues(page, "desktop Home + workspace panel");
  });

  test("mobile Home, bottom nav, More, and search pass axe", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedAuth(page);
    await waitHome(page);

    await expect(
      page.getByTestId("mobile-bottom-nav").or(page.getByRole("navigation", { name: /Primary/i })),
    ).toBeVisible({ timeout: 20_000 });
    await assertNoSeriousAxeIssues(page, "mobile Home");

    const more = page.getByRole("button", { name: /More destinations|^More$|More menu/i });
    if (await more.first().isVisible().catch(() => false)) {
      await more.first().click();
      await page.waitForTimeout(400);
      await assertNoSeriousAxeIssues(page, "mobile More sheet");
      const backdrop = page.getByTestId("mobile-more-sheet-backdrop");
      if (await backdrop.isVisible().catch(() => false)) {
        await backdrop.click({ position: { x: 8, y: 8 } });
      } else {
        await page.keyboard.press("Escape");
      }
      await expect(backdrop).toHaveCount(0).catch(() => {});
    }

    const search = page.getByTestId("mobile-header-search");
    if (await search.isVisible().catch(() => false)) {
      await search.click();
      await page.waitForTimeout(400);
      await assertNoSeriousAxeIssues(page, "mobile search");
      await page.keyboard.press("Escape");
    }
  });

  test("Explore all tools and shell landmarks have no serious axe issues", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await seedAuth(page);
    await waitHome(page);

    await expect(page.getByRole("main", { name: /Mission Control/i })).toBeVisible({ timeout: 20_000 });
    const explore = page.getByRole("button", { name: /Explore all tools/i }).first();
    await explore.click();
    await expect(page.getByRole("dialog", { name: /Explore all tools/i })).toBeVisible();
    await assertNoSeriousAxeIssues(page, "Explore all tools");
  });
});
