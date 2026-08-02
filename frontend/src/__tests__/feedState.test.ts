import { describe, expect, it } from "vitest";

import {
  feedStateDetail,
  feedStateLabel,
  feedStateTone,
  resolveFeedState,
  type FeedState,
} from "../shared/feedState";

describe("resolveFeedState", () => {
  it("returns Offline when the browser is offline", () => {
    expect(resolveFeedState({ online: false, hasQuotes: true, connectionState: "connected" })).toBe("Offline");
  });

  it("returns Closed when the session is closed and quotes exist", () => {
    expect(resolveFeedState({ marketOpen: false, hasQuotes: true, connectionState: "disconnected" })).toBe("Closed");
  });

  it("returns Live when the stream is connected", () => {
    expect(resolveFeedState({ connectionState: "connected", hasQuotes: true })).toBe("Live");
  });

  it("returns Delayed for fallback or delayed feeds", () => {
    expect(resolveFeedState({ fallbackEnabled: true, hasQuotes: true, connectionState: "connected" })).toBe("Delayed");
    expect(resolveFeedState({ delayed: true, hasQuotes: true })).toBe("Delayed");
  });

  it("returns Cached when disconnected but quotes remain", () => {
    expect(resolveFeedState({ connectionState: "disconnected", hasQuotes: true })).toBe("Cached");
  });

  it("returns Offline when disconnected with no quotes", () => {
    expect(resolveFeedState({ connectionState: "disconnected", hasQuotes: false })).toBe("Offline");
  });

  it("explains Offline + cached quotes without using reassuring language alone", () => {
    const input = { connectionState: "disconnected" as const, hasQuotes: true };
    const state = resolveFeedState(input);
    expect(state).toBe("Cached");
    expect(feedStateDetail("Offline", input)).toMatch(/cached/i);
  });

  it("covers every feed state label and tone", () => {
    const states: FeedState[] = ["Live", "Delayed", "Cached", "Closed", "Offline"];
    for (const state of states) {
      expect(feedStateLabel(state)).toBe(state);
      expect(["green", "yellow", "red", "gray"]).toContain(feedStateTone(state));
    }
  });
});
