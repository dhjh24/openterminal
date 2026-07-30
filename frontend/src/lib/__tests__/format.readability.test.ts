/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  formatCompactNumber,
  formatGreek,
  formatPercent,
  formatPrice,
  formatSignedNumber,
  formatVolume,
  isMissingNumber,
  MISSING,
} from "../format";

describe("format readability helpers", () => {
  it("uses em dash for missing values and never shows NaN", () => {
    expect(MISSING).toBe("—");
    expect(formatPrice(NaN)).toBe(MISSING);
    expect(formatPrice(null as unknown as number)).toBe(MISSING);
    expect(formatPercent(undefined as unknown as number)).toBe(MISSING);
    expect(formatVolume(Number.NaN)).toBe(MISSING);
    expect(isMissingNumber(NaN)).toBe(true);
    expect(isMissingNumber(42)).toBe(false);
  });

  it("formats signed percents with real plus and minus", () => {
    expect(formatPercent(1.234)).toBe("+1.23%");
    expect(formatPercent(-2.5)).toBe("−2.50%");
    expect(formatPercent(0)).toBe("0.00%");
    expect(formatPercent(3, { signed: false })).toBe("3.00%");
  });

  it("formats large volumes with thousands separators", () => {
    expect(formatVolume(1234567)).toBe("1,234,567");
    expect(formatCompactNumber(4_500_000)).toBe("4.5M");
  });

  it("formats greeks with consistent precision", () => {
    expect(formatGreek(0.5123, "delta")).toBe("0.5123");
    expect(formatGreek(0.00012, "gamma")).toBe("0.0001");
    expect(formatGreek(24.5, "iv")).toBe("24.50%");
    expect(formatGreek(NaN, "vega")).toBe(MISSING);
  });

  it("formats signed numbers for P/L style output", () => {
    expect(formatSignedNumber(1200.5, { decimals: 2 })).toBe("+1,200.50");
    expect(formatSignedNumber(-88, { decimals: 0 })).toBe("−88");
  });
});
