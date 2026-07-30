/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockSocket = {
  url: string;
  readyState: number;
  onopen: ((ev: Event) => void) | null;
  onclose: ((ev: Event) => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

const sockets: MockSocket[] = [];

function latestSocket(): MockSocket {
  return sockets[sockets.length - 1];
}

beforeEach(() => {
  sockets.length = 0;
  vi.resetModules();
  vi.stubGlobal("location", { protocol: "http:", host: "localhost" });

  class MockWebSocket {
    url: string;
    readyState = WebSocket.CONNECTING;
    onopen: ((ev: Event) => void) | null = null;
    onclose: ((ev: Event) => void) | null = null;
    send = vi.fn();
    close = vi.fn(() => {
      this.readyState = WebSocket.CLOSED;
      this.onclose?.(new Event("close"));
    });

    constructor(url: string) {
      this.url = url;
      sockets.push(this);
      queueMicrotask(() => {
        if (this.readyState === WebSocket.CONNECTING) {
          this.readyState = WebSocket.OPEN;
          this.onopen?.(new Event("open"));
        }
      });
    }

    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
  }

  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function loadQuotesModule() {
  return import("../realtime/useQuotesStream");
}

describe("buildQuotesWsUrl", () => {
  it("builds relative api ws url from window location", async () => {
    const { buildQuotesWsUrl } = await loadQuotesModule();
    expect(buildQuotesWsUrl()).toBe("ws://localhost/api/ws/quotes");
  });
});

describe("normalizeMarket", () => {
  it("maps India aliases to NASDAQ in US profile", async () => {
    const { normalizeMarket } = await loadQuotesModule();
    expect(normalizeMarket("nse")).toBe("NASDAQ");
    expect(normalizeMarket(" Nse ")).toBe("NASDAQ");
    expect(normalizeMarket("NYSE")).toBe("NYSE");
  });
});

describe("useQuotesStream manager", () => {
  it("opens ws and subscribes with normalized tokens", async () => {
    const { useQuotesStream } = await loadQuotesModule();
    const { result, unmount } = renderHook(() => useQuotesStream("nse"));

    act(() => {
      result.current.subscribe(["reliance"]);
    });

    await waitFor(() => expect(sockets.length).toBe(1));
    expect(latestSocket().url).toBe("ws://localhost/api/ws/quotes");

    await waitFor(() => {
      expect(latestSocket().send).toHaveBeenCalledWith(
        JSON.stringify({ op: "subscribe", symbols: ["NASDAQ:RELIANCE"] }),
      );
    });

    act(() => {
      result.current.unsubscribe(["reliance"]);
    });
    unmount();
  });

  it("dedupes symbols and normalizes casing", async () => {
    const { useQuotesStream } = await loadQuotesModule();
    const { result, unmount } = renderHook(() => useQuotesStream(" Nse "));

    act(() => {
      result.current.subscribe(["  aapl ", "aapl"]);
    });

    await waitFor(() => expect(sockets.length).toBe(1));

    await waitFor(() => {
      expect(latestSocket().send).toHaveBeenCalledWith(
        JSON.stringify({ op: "subscribe", symbols: ["NASDAQ:AAPL"] }),
      );
    });

    act(() => {
      result.current.unsubscribe(["aapl"]);
    });
    unmount();
  });

  it("closes socket when refcount hits zero", async () => {
    const { useQuotesStream } = await loadQuotesModule();
    const { result, unmount } = renderHook(() => useQuotesStream("nasdaq"));

    act(() => {
      result.current.subscribe(["msft"]);
    });
    await waitFor(() => expect(sockets.length).toBe(1));

    act(() => {
      result.current.unsubscribe(["msft"]);
    });

    await waitFor(() => {
      expect(latestSocket().close).toHaveBeenCalled();
    });
    unmount();
  });

  it("does not reconnect when subscriptions are cleared", async () => {
    const { useQuotesStream } = await loadQuotesModule();
    const { result, unmount } = renderHook(() => useQuotesStream("nasdaq"));

    act(() => {
      result.current.subscribe(["tcs"]);
    });
    await waitFor(() => expect(sockets.length).toBe(1));

    const socketsBefore = sockets.length;
    act(() => {
      result.current.unsubscribe(["tcs"]);
    });

    await waitFor(() => expect(latestSocket().close).toHaveBeenCalled());

    act(() => {
      latestSocket().onclose?.(new Event("close"));
    });

    await waitFor(() => expect(sockets.length).toBe(socketsBefore));
    unmount();
  });
});
