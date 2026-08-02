import { describe, expect, it } from "vitest";

import { feedStateDetail, resolveFeedState } from "../shared/feedState";

/**
 * Regression guard for the Home vs status-bar contradiction:
 * do not show a reassuring quote-ready message while the shared model is Offline.
 */
describe("feed state consistency", () => {
  it("never reports Live when the stream is disconnected", () => {
    const state = resolveFeedState({
      connectionState: "disconnected",
      hasQuotes: true,
      online: true,
    });
    expect(state).not.toBe("Live");
    expect(["Cached", "Offline", "Closed", "Delayed"]).toContain(state);
  });

  it("pairs Offline with an explanation when local quotes remain", () => {
    const detail = feedStateDetail("Offline", { hasQuotes: true, connectionState: "disconnected" });
    expect(detail).toMatch(/cached|disconnected/i);
  });

  it("resolves identical labels for Home/status-bar/chart shared inputs", () => {
    const sharedInput = {
      online: true,
      connectionState: "disconnected" as const,
      marketOpen: true,
      fallbackEnabled: false,
      hasQuotes: true,
      lastUpdateAgeMs: 5_000,
    };
    const home = resolveFeedState(sharedInput);
    const statusBar = resolveFeedState(sharedInput);
    const chart = resolveFeedState(sharedInput);
    expect(home).toBe(statusBar);
    expect(statusBar).toBe(chart);
    expect(home).not.toBe("Live");
    if (home === "Offline") {
      expect(feedStateDetail(home, sharedInput)).toBeTruthy();
    }
  });

  it("does not treat polling mode alone as Delayed when API fallback is off", () => {
    const withApiFallback = resolveFeedState({
      online: true,
      connectionState: "connected",
      marketOpen: true,
      fallbackEnabled: true,
      hasQuotes: true,
      lastUpdateAgeMs: 1_000,
    });
    const withoutFallback = resolveFeedState({
      online: true,
      connectionState: "connected",
      marketOpen: true,
      fallbackEnabled: false,
      hasQuotes: true,
      lastUpdateAgeMs: 1_000,
    });
    expect(withApiFallback).toBe("Delayed");
    expect(withoutFallback).toBe("Live");
  });
});
