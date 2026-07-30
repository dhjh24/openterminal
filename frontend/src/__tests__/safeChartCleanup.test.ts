import { describe, expect, it, vi } from "vitest";

import {
  isValidChartSize,
  readValidContainerSize,
  safeDestroyChart,
  safeRemoveSeries,
} from "../shared/chart/safeChartCleanup";

describe("safeRemoveSeries", () => {
  it("succeeds when chart and series are live", () => {
    const series = { id: "main" };
    const removeSeries = vi.fn();
    const chart = { removeSeries } as any;

    expect(safeRemoveSeries(chart, series as any)).toBe(true);
    expect(removeSeries).toHaveBeenCalledWith(series);
  });

  it("no-ops on null chart or series", () => {
    const removeSeries = vi.fn();
    const chart = { removeSeries } as any;
    const series = { id: "main" } as any;

    expect(safeRemoveSeries(null, series)).toBe(false);
    expect(safeRemoveSeries(chart, null)).toBe(false);
    expect(safeRemoveSeries(undefined, undefined)).toBe(false);
    expect(removeSeries).not.toHaveBeenCalled();
  });

  it("swallows destroyed / undefined errors", () => {
    const chart = {
      removeSeries: vi.fn(() => {
        throw new Error("Value is undefined");
      }),
    } as any;
    const series = { id: "main" } as any;

    expect(safeRemoveSeries(chart, series)).toBe(false);

    chart.removeSeries = vi.fn(() => {
      throw new Error("Chart is already destroyed");
    });
    expect(safeRemoveSeries(chart, series)).toBe(false);

    chart.removeSeries = vi.fn(() => {
      throw new Error("disposed");
    });
    expect(safeRemoveSeries(chart, series)).toBe(false);
  });

  it("rethrows unexpected errors", () => {
    const chart = {
      removeSeries: vi.fn(() => {
        throw new Error("network timeout");
      }),
    } as any;
    const series = { id: "main" } as any;

    expect(() => safeRemoveSeries(chart, series)).toThrow("network timeout");
  });
});

describe("safeDestroyChart", () => {
  it("destroys once and no-ops on second call after remove", () => {
    const remove = vi.fn();
    const chart = { remove } as any;

    expect(safeDestroyChart(chart)).toBe(true);
    expect(remove).toHaveBeenCalledTimes(1);

    remove.mockImplementation(() => {
      throw new Error("already destroyed");
    });
    expect(safeDestroyChart(chart)).toBe(false);
  });

  it("no-ops on null chart", () => {
    expect(safeDestroyChart(null)).toBe(false);
    expect(safeDestroyChart(undefined)).toBe(false);
  });
});

describe("isValidChartSize", () => {
  it("rejects zero, negative, and NaN dimensions", () => {
    expect(isValidChartSize(0, 100)).toBe(false);
    expect(isValidChartSize(100, 0)).toBe(false);
    expect(isValidChartSize(-1, 100)).toBe(false);
    expect(isValidChartSize(100, -1)).toBe(false);
    expect(isValidChartSize(NaN, 100)).toBe(false);
    expect(isValidChartSize(100, NaN)).toBe(false);
  });

  it("accepts positive finite dimensions", () => {
    expect(isValidChartSize(1, 1)).toBe(true);
    expect(isValidChartSize(640, 480)).toBe(true);
  });
});

describe("readValidContainerSize", () => {
  it("returns null for zero width containers", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 0, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: 400, configurable: true });

    expect(readValidContainerSize(el)).toBeNull();
  });

  it("returns null for null element", () => {
    expect(readValidContainerSize(null)).toBeNull();
  });

  it("returns dimensions when container is measurable", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 800, configurable: true });
    Object.defineProperty(el, "clientHeight", { value: 0, configurable: true });

    expect(readValidContainerSize(el, 520)).toEqual({ width: 800, height: 520 });
  });
});
