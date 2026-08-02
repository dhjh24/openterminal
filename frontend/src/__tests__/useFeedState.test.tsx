import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFeedState } from "../hooks/useFeedState";
import { useQuotesStore } from "../realtime/useQuotesStream";
import { useUSQuotesStore } from "../realtime/useUsQuotesStream";

vi.mock("../hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({ online: true, lastOnlineAt: null }),
}));

vi.mock("../hooks/useStocks", () => ({
  useMarketStatus: () => ({
    data: {
      nyseStatus: "OPEN",
      nseStatus: "CLOSED",
      fallbackEnabled: false,
      marketState: [{ marketStatus: "CLOSED" }],
    },
  }),
}));

describe("useFeedState", () => {
  beforeEach(() => {
    useQuotesStore.setState({
      connectionState: "disconnected",
      ticksByToken: {
        "NASDAQ:AAPL": { ts: new Date().toISOString(), ltp: 190 } as never,
      },
    } as never);
    useUSQuotesStore.setState({
      connectionState: "disconnected",
      lastMessageAt: null,
    } as never);
  });

  it("returns Cached/Offline vocabulary instead of Live when disconnected with quotes", () => {
    const { result } = renderHook(() => useFeedState());
    expect(result.current.state).not.toBe("Live");
    expect(["Cached", "Offline", "Closed", "Delayed"]).toContain(result.current.state);
    expect(result.current.label).toBe(result.current.state);
  });

  it("reports Live when connected with fresh quotes", () => {
    useQuotesStore.setState({ connectionState: "connected" } as never);
    useUSQuotesStore.setState({ connectionState: "connected", lastMessageAt: Date.now() } as never);
    const { result } = renderHook(() => useFeedState());
    expect(result.current.state).toBe("Live");
  });
});
