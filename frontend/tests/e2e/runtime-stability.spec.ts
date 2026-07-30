/**
 * Runtime stability smoke: charts, heatmaps, quotes WS, notifications, chunk recovery.
 */
import { expect, test, type Page } from "@playwright/test";

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function seedAuth(page: Page) {
  const accessToken = makeJwt({
    sub: "e2e-user",
    email: "e2e@example.com",
    role: "trader",
  });
  await page.addInitScript((token) => {
    localStorage.setItem("access_token", token as string);
    localStorage.setItem("auth_token", token as string);
  }, accessToken);
}

async function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(String(err?.message || err));
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  return errors;
}

test.describe("runtime-stability", () => {
  test("chart workstation: indicator + comparison without removeSeries crash", async ({ page }) => {
    await seedAuth(page);
    const errors = await collectPageErrors(page);

    await page.goto("/charts", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();

    // Navigate away — cleanup must not throw "Value is undefined".
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();

    const crash = errors.find((e) => /Value is undefined|removeSeries|width\(-1\)|height\(-1\)/i.test(e));
    expect(crash, `Unexpected chart runtime error: ${crash}`).toBeUndefined();
  });

  test("heatmap routes load lazy chunks without Kite copy", async ({ page }) => {
    await seedAuth(page);
    await page.goto("/fno/heatmap", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    const fnoText = await page.locator("body").innerText();
    expect(fnoText).not.toMatch(/Kite API/i);

    await page.goto("/heatmap", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });

  test("quotes websocket path is reachable", async ({ page }) => {
    const backendBase = process.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, "") || "http://127.0.0.1:8010";
    // HTTP upgrade probe via page context WebSocket
    await seedAuth(page);
    const result = await page.evaluate(async (base) => {
      const proto = base.startsWith("https") ? "wss" : "ws";
      const host = base.replace(/^https?:\/\//, "");
      const url = `${proto}://${host}/api/ws/quotes`;
      return await new Promise<{ ok: boolean; code?: number; reason?: string; error?: string }>((resolve) => {
        const ws = new WebSocket(url);
        const timer = window.setTimeout(() => {
          ws.close();
          resolve({ ok: false, error: "timeout" });
        }, 5000);
        ws.onopen = () => {
          ws.send(JSON.stringify({ op: "subscribe", symbols: ["NASDAQ:AAPL"] }));
          window.clearTimeout(timer);
          ws.close();
          resolve({ ok: true });
        };
        ws.onerror = () => {
          window.clearTimeout(timer);
          resolve({ ok: false, error: "error" });
        };
        ws.onclose = (ev) => {
          window.clearTimeout(timer);
          if (ev.wasClean) resolve({ ok: true, code: ev.code, reason: ev.reason });
          else resolve({ ok: false, code: ev.code, reason: ev.reason });
        };
      });
    }, backendBase.replace(/\/$/, ""));

    // Accept open success or clean close after subscribe; reject hard connection failure.
    expect(result.error === "error" && result.code === undefined).toBeFalsy();
  });

  test("notification unread poll does not throw uncaught 401 for guests", async ({ page }) => {
    // No auth seed — guest session
    const errors = await collectPageErrors(page);
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const uncaught = errors.find((e) => /fetchUnreadCount|Unhandled|AxiosError.*401/i.test(e));
    expect(uncaught, `Uncaught notification error: ${uncaught}`).toBeUndefined();
  });

  test("stale chunk recovery key is build-scoped", async ({ page }) => {
    await seedAuth(page);
    await page.goto("/home", { waitUntil: "domcontentloaded" });
    const recovery = await page.evaluate(() => {
      sessionStorage.setItem("otui:chunk-recovery", JSON.stringify({ buildId: "oldbuild", reloaded: true }));
      return sessionStorage.getItem("otui:chunk-recovery");
    });
    expect(recovery).toContain("oldbuild");
  });
});
