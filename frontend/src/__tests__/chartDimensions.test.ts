import { describe, expect, it } from "vitest";

import { isValidChartSize, readValidContainerSize } from "../shared/chart/safeChartCleanup";

describe("chartDimensions hidden panels", () => {
  it("rejects collapsed / hidden panel measurements", () => {
    expect(isValidChartSize(0, 520)).toBe(false);
    expect(isValidChartSize(0, 0)).toBe(false);
    expect(isValidChartSize(1, 0)).toBe(false);
  });

  it("returns null when a hidden panel reports zero width", () => {
    const hidden = document.createElement("div");
    Object.defineProperty(hidden, "clientWidth", { value: 0, configurable: true });
    Object.defineProperty(hidden, "clientHeight", { value: 0, configurable: true });

    expect(readValidContainerSize(hidden)).toBeNull();
    expect(readValidContainerSize(hidden, 520)).toBeNull();
  });

  it("uses fallback height when width is valid but height is zero", () => {
    const panel = document.createElement("div");
    Object.defineProperty(panel, "clientWidth", { value: 420, configurable: true });
    Object.defineProperty(panel, "clientHeight", { value: 0, configurable: true });

    expect(readValidContainerSize(panel, 360)).toEqual({ width: 420, height: 360 });
  });

  it("accepts visible panel dimensions", () => {
    const panel = document.createElement("div");
    Object.defineProperty(panel, "clientWidth", { value: 1024, configurable: true });
    Object.defineProperty(panel, "clientHeight", { value: 768, configurable: true });

    expect(isValidChartSize(panel.clientWidth, panel.clientHeight)).toBe(true);
    expect(readValidContainerSize(panel)).toEqual({ width: 1024, height: 768 });
  });
});
