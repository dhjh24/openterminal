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
});
