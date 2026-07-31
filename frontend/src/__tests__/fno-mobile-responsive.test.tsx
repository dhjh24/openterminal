/**
 * Tests for FNO symbol validation, empty states, and summary card.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Use direct imports for all tests
import { setMarketProfileOverride } from "../config/marketProfile";
import {
  isValidForMarketProfile,
  getSymbolValidationError,
  resolveFnoSymbol,
} from "../fno/validation/usSymbolValidation";

describe("usSymbolValidation", () => {
  beforeEach(() => {
    setMarketProfileOverride(null);
    localStorage.clear();
  });

  it("rejects N225 in US mode", () => {
    setMarketProfileOverride("US");
    expect(isValidForMarketProfile("N225")).toBe(false);
    expect(getSymbolValidationError("N225")).toContain("not a U.S. symbol");
  });

  it("rejects .NS suffix in US mode", () => {
    setMarketProfileOverride("US");
    expect(isValidForMarketProfile("RELIANCE.NS")).toBe(false);
    expect(getSymbolValidationError("RELIANCE.NS")).toContain("not a U.S. symbol");
  });

  it("rejects .BO suffix in US mode", () => {
    setMarketProfileOverride("US");
    expect(isValidForMarketProfile("TCS.BO")).toBe(false);
  });

  it("rejects NIFTY, BANKNIFTY, SENSEX in US mode", () => {
    setMarketProfileOverride("US");
    expect(isValidForMarketProfile("NIFTY")).toBe(false);
    expect(isValidForMarketProfile("BANKNIFTY")).toBe(false);
    expect(isValidForMarketProfile("SENSEX")).toBe(false);
  });

  it("allows SPY in US mode", () => {
    setMarketProfileOverride("US");
    expect(isValidForMarketProfile("SPY")).toBe(true);
  });

  it("allows AAPL, MSFT, NVDA in US mode", () => {
    setMarketProfileOverride("US");
    expect(isValidForMarketProfile("AAPL")).toBe(true);
    expect(isValidForMarketProfile("MSFT")).toBe(true);
    expect(isValidForMarketProfile("NVDA")).toBe(true);
  });

  it("allows everything when market profile is not US", () => {
    setMarketProfileOverride("IN");
    expect(isValidForMarketProfile("N225")).toBe(true);
    expect(isValidForMarketProfile("NIFTY")).toBe(true);
    expect(isValidForMarketProfile("RELIANCE.NS")).toBe(true);
  });

  it("resolveFnoSymbol migrates N225 to SPY in US mode", () => {
    setMarketProfileOverride("US");
    localStorage.setItem("fno:selectedSymbol", "N225");
    expect(resolveFnoSymbol("N225")).toBe("SPY");
    expect(localStorage.getItem("fno:selectedSymbol")).toBeNull();
  });

  it("resolveFnoSymbol keeps valid SPY", () => {
    setMarketProfileOverride("US");
    expect(resolveFnoSymbol("SPY")).toBe("SPY");
  });

  it("resolveFnoSymbol returns SPY for empty/null input", () => {
    expect(resolveFnoSymbol(null)).toBe("SPY");
    expect(resolveFnoSymbol("")).toBe("SPY");
    expect(resolveFnoSymbol(undefined)).toBe("SPY");
  });
});

// --- StrikeSummaryBar empty state ---

describe("StrikeSummaryBar empty state", () => {
  it("renders em dashes when summary is undefined", async () => {
    const { StrikeSummaryBar } = await import("../fno/components/StrikeSummaryBar");
    const { render } = await import("@testing-library/react");
    const { MemoryRouter } = await import("react-router-dom");

    const { container } = render(
      <MemoryRouter>
        <StrikeSummaryBar symbol="SPY" expiry="" spotPrice={0} summary={undefined} />
      </MemoryRouter>
    );
    const text = container.textContent || "";
    const emDashCount = (text.match(/—/g) || []).length;
    expect(emDashCount).toBeGreaterThanOrEqual(4);
    expect(text).not.toContain("0.00%");
    expect(text).toContain("SPY");
  });

  it("renders em dash for IV Rank when summary has no iv_rank", async () => {
    const { StrikeSummaryBar } = await import("../fno/components/StrikeSummaryBar");
    const { render } = await import("@testing-library/react");
    const { MemoryRouter } = await import("react-router-dom");

    const summary = {
      symbol: "SPY", expiry_date: "2026-08-15", spot_price: 550,
      atm_strike: 550, atm_iv: 22.5,
      pcr: { pcr_oi: 0.85, pcr_volume: 1.2, pcr_oi_change: 0.05, signal: "bullish" },
      max_pain: 548,
      support_resistance: { support: [545], resistance: [555] },
    } as any;

    const { container } = render(
      <MemoryRouter>
        <StrikeSummaryBar symbol="SPY" expiry="2026-08-15" spotPrice={550} summary={summary} />
      </MemoryRouter>
    );
    const text = container.textContent || "";
    expect(text).toContain("22.50%");
    expect(text).toContain("548");
    expect(text).toContain("—");
  });

  it("renders true zero values (not replaced by dash)", async () => {
    const { StrikeSummaryBar } = await import("../fno/components/StrikeSummaryBar");
    const { render } = await import("@testing-library/react");
    const { MemoryRouter } = await import("react-router-dom");

    const summary = {
      symbol: "SPY", expiry_date: "2026-08-15", spot_price: 550,
      atm_strike: 550, atm_iv: 0,
      pcr: { pcr_oi: 0, pcr_volume: 0, pcr_oi_change: 0, signal: "neutral" },
      max_pain: 550,
      support_resistance: { support: [545], resistance: [555] },
    } as any;

    const { container } = render(
      <MemoryRouter>
        <StrikeSummaryBar symbol="SPY" expiry="2026-08-15" spotPrice={550} summary={summary} />
      </MemoryRouter>
    );
    const text = container.textContent || "";
    expect(text).toContain("0.00");
  });
});

// --- StrikeSummaryBar desktop layout ---

describe("StrikeSummaryBar desktop layout", () => {
  it("renders metrics with data", async () => {
    const { StrikeSummaryBar } = await import("../fno/components/StrikeSummaryBar");
    const { render } = await import("@testing-library/react");
    const { MemoryRouter } = await import("react-router-dom");

    const summary = {
      symbol: "SPY", expiry_date: "2026-08-15", spot_price: 550,
      atm_strike: 550, atm_iv: 22.5, iv_rank: 45, iv_percentile: 60,
      pcr: { pcr_oi: 0.85, pcr_volume: 1.2, pcr_oi_change: 0.05, signal: "bullish" },
      max_pain: 548,
      support_resistance: { support: [545], resistance: [555] },
    } as any;

    const { container } = render(
      <MemoryRouter>
        <StrikeSummaryBar symbol="SPY" expiry="2026-08-15" spotPrice={550} summary={summary} />
      </MemoryRouter>
    );
    const text = container.textContent || "";
    expect(text).toContain("SPY");
    expect(text).toContain("22.50%");
    expect(text).toContain("45.0%");
    expect(text).toContain("0.85");
  });
});

// --- No-expiry empty state ---

describe("OptionChainPage empty state", () => {
  it("shows no-expiry prompt when expiry is empty", async () => {
    vi.mock("../fno/FnoLayout", () => ({
      useFnoContext: () => ({ symbol: "SPY", setSymbol: vi.fn(), expiry: "", setExpiry: vi.fn(), expiries: [] }),
    }));
    vi.mock("@tanstack/react-query", () => ({
      useQuery: () => ({ data: undefined, isLoading: false, isError: false, isFetching: false }),
    }));

    const { OptionChainPage } = await import("../fno/pages/OptionChainPage");
    const { render } = await import("@testing-library/react");
    const { MemoryRouter } = await import("react-router-dom");

    const { container } = render(
      <MemoryRouter>
        <OptionChainPage />
      </MemoryRouter>
    );
    const text = container.textContent || "";
    expect(text).toContain("No expiry selected");
    expect(text).toContain("Select an expiry to view options data");
  });
});
