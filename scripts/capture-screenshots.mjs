#!/usr/bin/env node
/**
 * Capture before/after screenshots of the Home page at multiple viewport sizes.
 * Usage: node capture-screenshots.mjs <before|after>
 *
 * Requires: vite dev server running on http://localhost:5173 or PORT env var
 * Output: docs/screenshots/<before|after>/<viewport>-home.png
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../../docs/screenshots");
const PORT = process.env.PORT || 5173;
const BASE_URL = `http://localhost:${PORT}`;

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "393x852", width: 393, height: 852 },
  { name: "412x915", width: 412, height: 915 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

const LABEL = process.argv[2];
if (!["before", "after"].includes(LABEL)) {
  console.error("Usage: node capture-screenshots.mjs <before|after>");
  process.exit(1);
}

const outDir = resolve(OUT_DIR, LABEL);
mkdirSync(outDir, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });

  for (const vp of VIEWPORTS) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });

    try {
      await page.goto(`${BASE_URL}/home`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });

      // Wait for the main content to render
      await page.waitForSelector("main", { timeout: 10000 }).catch(() => {});

      // Small delay for any animations
      await page.waitForTimeout(500);

      const filePath = resolve(outDir, `${vp.name}-home.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`✓ ${vp.name} -> ${filePath}`);
    } catch (err) {
      console.error(`✗ ${vp.name}: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\nDone. Screenshots in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
