/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsPhone } from "../hooks/useIsPhone";

type Listener = () => void;

function createMatchMedia(matches: boolean) {
  const listeners: Listener[] = [];

  const mq = {
    matches,
    media: "",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_type: string, listener: Listener) => {
      listeners.push(listener);
    },
    removeEventListener: (_type: string, listener: Listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
    dispatchEvent: vi.fn(),
  } as MediaQueryList;

  return { mq, listeners };
}

describe("useIsPhone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when matchMedia reports a phone viewport", () => {
    const { mq } = createMatchMedia(true);
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
      mq.media = query;
      return mq;
    });

    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(true);
  });

  it("returns false when matchMedia reports a desktop viewport", () => {
    const { mq } = createMatchMedia(false);
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
      mq.media = query;
      return mq;
    });

    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);
  });

  it("updates when the media query changes", () => {
    const { mq, listeners } = createMatchMedia(false);
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
      mq.media = query;
      return mq;
    });

    const { result } = renderHook(() => useIsPhone());
    expect(result.current).toBe(false);

    act(() => {
      mq.matches = true;
      listeners.forEach((listener) => listener());
    });

    expect(result.current).toBe(true);
  });
});
