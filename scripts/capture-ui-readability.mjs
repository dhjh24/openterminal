#!/usr/bin/env node
/**
 * Capture UI readability screenshots across primary routes and viewports.
 * Usage:
 *   CAPTURE_BASE_URL=http://127.0.0.1:8005 CAPTURE_OUT=docs/ui-readability/before CAPTURE_PHASE=before node scripts/capture-ui-readability.mjs
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../frontend/package.json"));
const { chromium } = require("@playwright/test");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.CAPTURE_BASE_URL || "http://127.0.0.1:8005";
const OUT = path.resolve(ROOT, process.env.CAPTURE_OUT || "docs/ui-readability/before");
const PHASE = process.env.CAPTURE_PHASE || "before";

const VIEWPORTS = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "390x844", width: 390, height: 844 },
];

const ROUTES = [
  { id: "home", path: "/home" },
  { id: "stock-detail", path: "/equity/stocks" },
  { id: "chart-workstation", path: "/equity/chart-workstation" },
  { id: "option-chain", path: "/fno" },
  { id: "greeks", path: "/fno/greeks" },
  { id: "options-flow", path: "/fno/flow" },
  { id: "fno-heatmap", path: "/fno/heatmap" },
  { id: "market-heatmap", path: "/equity/heatmap" },
  { id: "screener", path: "/equity/screener" },
  { id: "watchlist", path: "/equity/watchlist" },
  { id: "news", path: "/equity/news" },
  { id: "alerts", path: "/equity/alerts" },
  { id: "portfolio", path: "/equity/portfolio" },
  { id: "risk", path: "/equity/risk" },
  { id: "settings", path: "/equity/settings" },
];

function makeJwt(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `x.${encoded}.y`;
}

async function settle(page) {
  await page
    .getByText(/(?:Restoring|Loading) workspace/i)
    .waitFor({ state: "hidden", timeout: 12_000 })
    .catch(() => {});
  await page.waitForTimeout(1400);
}

async function gotoWithRetry(page, routePath, attempts = 4) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto(`${BASE}${routePath}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await settle(page);
      return;
    } catch (err) {
      lastError = err;
      await page.waitForTimeout(1500 * (i + 1));
    }
  }
  throw lastError;
}

async function ensureAuthed(page, routePath) {
  await gotoWithRetry(page, routePath);

  // If still on login, rely on injected JWT by revisiting after a short pause.
  const onLogin = await page.locator("form").filter({ hasText: /ACCESS TERMINAL|DEMO ACCESS/i }).isVisible().catch(() => false);
  if (onLogin) {
    await page.waitForTimeout(500);
    await gotoWithRetry(page, routePath);
  }
}

async function collectFlags(page) {
  return page.evaluate(() => {
    const notes = [];
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 2) {
      notes.push("horizontal overflow");
    }
    let small = 0;
    const samples = [];
    const all = document.body.querySelectorAll("*");
    for (let i = 0; i < Math.min(all.length, 3000); i++) {
      const el = all[i];
      if (!(el instanceof HTMLElement)) continue;
      const t = (el.innerText || "").trim();
      if (!t || t.length > 48 || el.children.length > 2) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size > 0 && size < 11) {
        small += 1;
        if (samples.length < 5) samples.push(`${Math.round(size * 10) / 10}px:${t.slice(0, 28)}`);
      }
    }
    if (small) notes.push(`sub-11px≈${small}${samples.length ? ` (${samples.join("; ")})` : ""}`);
    return notes;
  });
}

fs.mkdirSync(OUT, { recursive: true });
const auditPath = path.join(path.dirname(OUT), "notes", `${PHASE}-audit.md`);
fs.mkdirSync(path.dirname(auditPath), { recursive: true });
const auditLines = [
  `# UI readability audit (${PHASE})`,
  "",
  `Base: ${BASE}`,
  `Captured: ${new Date().toISOString()}`,
  "",
];

const browser = await chromium.launch({ args: ["--disable-gpu"] });
const accessToken = makeJwt({
  sub: "ui-audit",
  email: "audit@example.com",
  role: "trader",
  exp: Math.floor(Date.now() / 1000) + 7200,
});
const refreshToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 14400 });

async function waitHealthy(url, tries = 20) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status === 200 || res.status === 304) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

await waitHealthy(BASE);

for (const vp of VIEWPORTS) {
  await waitHealthy(BASE);
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  await context.addInitScript(
    ([at, rt]) => {
      localStorage.setItem("ot-access-token", at);
      localStorage.setItem("ot-refresh-token", rt);
    },
    [accessToken, refreshToken],
  );
  const page = await context.newPage();

  for (const route of ROUTES) {
    const file = path.join(OUT, `${route.id}__${vp.name}.png`);
    auditLines.push(`## ${route.id} @ ${vp.name}`);
    try {
      await ensureAuthed(page, route.path);
      const title = await page.title().catch(() => "");
      const bodyText = await page.locator("body").innerText().catch(() => "");
      if (/ACCESS TERMINAL|DEMO ACCESS/i.test(bodyText) && !/Command|Watchlist|Screener|Portfolio/i.test(bodyText)) {
        auditLines.push("- captured login gate (auth token not accepted by this build)");
      } else {
        const flags = await collectFlags(page);
        auditLines.push(flags.length ? flags.map((f) => `- ${f}`).join("\n") : "- captured (no automated flags)");
      }
      await page.screenshot({ path: file, fullPage: false });
      console.log(`OK ${route.id} ${vp.name} (${title})`);
    } catch (err) {
      auditLines.push(`- CAPTURE FAILED: ${err.message}`);
      console.error(`FAIL ${route.id} ${vp.name}:`, err.message);
    }
    auditLines.push("");
    await page.waitForTimeout(400);
  }
  await context.close();
}

await browser.close();
fs.writeFileSync(auditPath, auditLines.join("\n"));
console.log(`Wrote ${auditPath}`);
console.log(`Screenshots in ${OUT}`);
