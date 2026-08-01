import { describe, expect, it } from "vitest";

import { accessibleToolName, badgeAccessibleTitle, PLAIN_LANGUAGE } from "../home/productLanguage";

describe("productLanguage", () => {
  it("builds accessible names with optional descriptions", () => {
    expect(accessibleToolName("Portfolio")).toBe("Portfolio");
    expect(accessibleToolName("Charts", "Chart workstation for analysis")).toBe(
      "Charts. Chart workstation for analysis",
    );
  });

  it("explains badge abbreviations with the full label", () => {
    expect(badgeAccessibleTitle("PCR", "Put/call ratio")).toBe("PCR shortcut for Put/call ratio");
  });

  it("maps internal abbreviations to plain language", () => {
    expect(PLAIN_LANGUAGE.PM).toBe("Portfolio");
    expect(PLAIN_LANGUAGE.Ops).toBe("Operations");
    expect(PLAIN_LANGUAGE.DOM).toBe("Depth of market");
    expect(PLAIN_LANGUAGE.OMS).toBe("Order management");
    expect(PLAIN_LANGUAGE.PCR).toBe("Put/call ratio");
  });
});
