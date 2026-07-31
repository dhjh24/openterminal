import { describe, expect, it } from "vitest";

import { formatInr, formatUsd } from "../utils/formatters";

describe("formatters US", () => {
  it("formatUsd and formatInr never contain the rupee symbol", () => {
    const values = [0, 12.5, 1234.5, 1_000_000];

    for (const value of values) {
      expect(formatUsd(value)).not.toContain("₹");
      expect(formatInr(value)).not.toContain("₹");
    }

    expect(formatUsd(null)).not.toContain("₹");
    expect(formatInr(undefined)).not.toContain("₹");
  });

  it("formatUsd formats values as USD", () => {
    const formatted = formatUsd(1234.5);

    expect(formatted).toMatch(/\$/);
    expect(formatted.replace(/\D/g, "")).toContain("12345");
  });
});
