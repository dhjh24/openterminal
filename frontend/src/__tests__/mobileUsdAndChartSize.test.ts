import { describe, expect, it } from "vitest";
import { formatUsd, formatInr, formatPct } from "../utils/formatters";
import { isValidChartSize, readValidContainerSize } from "../shared/chart/safeChartCleanup";

describe("formatUsd", () => {
  it("formats USD with en-US separators", () => {
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(2_500_000)).toBe("$2,500,000.00");
    expect(formatUsd(null)).toBe("-");
  });

  it("formatInr alias returns USD not rupees", () => {
    const out = formatInr(100);
    expect(out).toContain("$");
    expect(out).not.toContain("₹");
    expect(out).not.toContain("\u20b9");
  });

  it("formats percents", () => {
    expect(formatPct(1.234)).toBe("1.23%");
  });
});

describe("chart container size guards", () => {
  it("rejects non-positive dimensions", () => {
    expect(isValidChartSize(0, 100)).toBe(false);
    expect(isValidChartSize(100, 0)).toBe(false);
    expect(isValidChartSize(-1, 320)).toBe(false);
    expect(isValidChartSize(390, 320)).toBe(true);
  });

  it("falls back height when clientHeight is 0 but width is valid", () => {
    const el = { clientWidth: 390, clientHeight: 0 } as HTMLElement;
    const size = readValidContainerSize(el, 320);
    expect(size).toEqual({ width: 390, height: 320 });
  });

  it("returns null when width is zero", () => {
    const el = { clientWidth: 0, clientHeight: 400 } as HTMLElement;
    expect(readValidContainerSize(el)).toBeNull();
  });
});
