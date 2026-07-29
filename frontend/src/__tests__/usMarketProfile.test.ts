import { beforeEach, describe, expect, it } from "vitest";

import { normalizePersistedMarket } from "../store/settingsStore";
import type { CountryCode, MarketCode } from "../types/markets";

describe("usMarketProfile", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("normalizes legacy India markets to NASDAQ", () => {
    expect(normalizePersistedMarket("NSE")).toBe("NASDAQ");
    expect(normalizePersistedMarket("BSE")).toBe("NASDAQ");
    expect(normalizePersistedMarket("IN")).toBe("NASDAQ");
  });

  it("allows US exchange codes", () => {
    const allowed: MarketCode[] = ["NYSE", "NASDAQ", "AMEX", "CBOE", "CME"];
    for (const market of allowed) {
      expect(normalizePersistedMarket(market)).toBe(market);
    }
  });

  it("migrates persisted IN/NSE/INR settings to US/NASDAQ/USD", async () => {
    localStorage.setItem(
      "ui-settings",
      JSON.stringify({
        state: {
          selectedCountry: "IN",
          selectedMarket: "NSE",
          displayCurrency: "INR",
          recentSecurities: [{ symbol: "RELIANCE", name: "Reliance", assetClass: "equity", market: "IN", visitedAt: 1 }],
        },
        version: 0,
      }),
    );

    vi.resetModules();
    const { useSettingsStore } = await import("../store/settingsStore");
    const state = useSettingsStore.getState();

    expect(state.selectedCountry).toBe("US");
    expect(state.selectedMarket).toBe("NASDAQ");
    expect(state.displayCurrency).toBe("USD");
    expect(state.recentSecurities[0]?.market).toBe("US");
    expect(state.recentSecurities[0]?.symbol).toBe("RELIANCE");
  });

  it("does not require IN in market types", () => {
    const country: CountryCode = "US";
    const markets: MarketCode[] = ["NASDAQ", "NYSE", "AMEX", "CBOE", "CME"];
    expect(country).toBe("US");
    expect(markets).not.toContain("NSE" as MarketCode);
    expect(markets).not.toContain("BSE" as MarketCode);
  });
});
