import { expect, test } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: import("@playwright/test").Page, mode = "standard") {
  const accessToken = makeJwt({
    sub: "chrome-mode-user",
    email: "chrome.mode@example.com",
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
  await page.addInitScript((chromeMode) => {
    if (sessionStorage.getItem("ot:e2e:chrome-seeded") === "1") return;
    sessionStorage.setItem("ot:e2e:chrome-seeded", "1");
    const settings = {
      state: {
        shellChromeMode: chromeMode,
        selectedMarket: "NASDAQ",
        displayCurrency: "USD",
      },
      version: 1,
    };
    localStorage.setItem("ui-settings", JSON.stringify(settings));
  }, mode);
}

test.describe("terminal chrome modes phase 4", () => {
  test("Focus mode hides tape and workspace chrome on home", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedAuth(page, "focus");
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("terminal-shell-chrome")).toHaveAttribute("data-shell-chrome", "focus", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("workspace-preset-selector")).toHaveCount(0);
  });

  test("Full mode keeps workspace switcher", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedAuth(page, "full");
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("terminal-shell-chrome")).toHaveAttribute("data-shell-chrome", "full", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("workspace-preset-selector")).toBeVisible();
  });

  test("Standard auto-focuses chart workstation on laptop width", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await seedAuth(page, "standard");
    await page.goto("/equity/chart-workstation", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("terminal-shell-chrome")).toHaveAttribute("data-shell-chrome", "focus", {
      timeout: 90_000,
    });
    await expect(page.getByTestId("workspace-preset-selector")).toHaveCount(0);
  });

  test("Appearance settings persist shell chrome mode", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedAuth(page, "standard");
    await page.goto("/equity/settings", { waitUntil: "domcontentloaded" });
    const select = page.getByTestId("shell-chrome-mode");
    await expect(select).toBeVisible({ timeout: 20_000 });
    await select.selectOption("full");
    await expect
      .poll(async () =>
        page.evaluate(() => {
          try {
            const raw = localStorage.getItem("ui-settings");
            if (!raw) return "";
            const parsed = JSON.parse(raw) as { state?: { shellChromeMode?: string } };
            return parsed.state?.shellChromeMode ?? "";
          } catch {
            return "";
          }
        }),
      )
      .toBe("full");
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("terminal-shell-chrome")).toHaveAttribute("data-shell-chrome", "full", {
      timeout: 20_000,
    });
  });
});
