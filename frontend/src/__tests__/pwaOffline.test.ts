import { beforeEach, describe, expect, it, vi } from "vitest";

import { assertOnlineForAction, isBrowserOnline, OFFLINE_BANNER_TEXT } from "../lib/offlineGuard";
import {
  clearWatchlistSnapshot,
  loadWatchlistSnapshot,
  saveWatchlistSnapshot,
  WATCHLIST_SNAPSHOT_KEY,
} from "../lib/watchlistSnapshot";

describe("offlineGuard", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("reports online when navigator.onLine is true", () => {
    expect(isBrowserOnline()).toBe(true);
  });

  it("blocks trading actions while offline", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    expect(() => assertOnlineForAction("Order submission")).toThrow(OFFLINE_BANNER_TEXT);
  });
});

describe("watchlistSnapshot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips a labeled snapshot", () => {
    saveWatchlistSnapshot({
      savedAt: "2026-07-29T12:00:00.000Z",
      market: "NYSE",
      watchlistId: "wl-1",
      watchlistName: "Core",
      symbols: ["AAPL"],
      quotes: [{ symbol: "AAPL", ltp: 190, change_pct: 1.2 }],
    });
    const loaded = loadWatchlistSnapshot();
    expect(loaded?.watchlistName).toBe("Core");
    expect(loaded?.quotes[0]?.ltp).toBe(190);
    expect(localStorage.getItem(WATCHLIST_SNAPSHOT_KEY)).toContain("AAPL");
    clearWatchlistSnapshot();
    expect(loadWatchlistSnapshot()).toBeNull();
  });
});

describe("service worker policy source", () => {
  it("never caches API paths and keeps shell/assets caches separate", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const swPath = path.resolve(__dirname, "../../public/sw.js");
    const source = fs.readFileSync(swPath, "utf8");
    expect(source).toContain('pathname.startsWith("/api/")');
    expect(source).toContain("otui-shell-");
    expect(source).toContain("otui-assets-v1");
    expect(source).toContain("SKIP_WAITING");
    expect(source).toContain('upgrade") === "websocket"');
    expect(source).toContain("__OTUI_BUILD_ID__");
  });

  it("documents that asset cache survives shell activation cleanup", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const swPath = path.resolve(__dirname, "../../public/sw.js");
    const source = fs.readFileSync(swPath, "utf8");
    // Two-tab deploy safety: only otui-shell-* keys are deleted on activate.
    expect(source).toMatch(/key\.startsWith\("otui-shell-"\)/);
    expect(source).not.toMatch(/caches\.delete\(ASSET_CACHE\)/);
  });
});

describe("manifest completeness", () => {
  it("includes required install fields and shortcuts", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../../public/manifest.json"), "utf8"),
    );
    expect(manifest.id).toBe("/");
    expect(manifest.name).toBe("OpenTerminal");
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("en-US");
    expect(manifest.dir).toBe("ltr");
    expect(manifest.scope).toBe("/");
    expect(manifest.shortcuts.map((s: { name: string }) => s.name)).toEqual([
      "Home",
      "Watchlist",
      "Stock Search",
      "Option Chain",
      "News",
      "Alerts",
    ]);
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose?.includes("maskable"))).toBe(true);
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "monochrome")).toBe(true);
    expect(manifest.share_target).toBeUndefined();
  });
});
