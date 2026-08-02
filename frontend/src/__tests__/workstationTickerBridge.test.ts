import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import { useChartWorkstationStore } from "../store/chartWorkstationStore";
import { useStockStore } from "../store/stockStore";
import {
  applyTickerToActiveWorkstationPane,
  inferSlotMarket,
  isChartWorkstationPath,
  registerWorkstationLinkedPropagator,
  seedActiveWorkstationPaneIfEmpty,
  syncStockTickerFromActiveWorkstationPane,
} from "../shared/workstationTickerBridge";

function baseSlot(id: string, ticker: string | null = null) {
  return {
    id,
    ticker,
    companyName: null,
    market: "US" as const,
    timeframe: "1D" as const,
    chartType: "candle" as const,
    indicators: [],
    extendedHours: {
      enabled: false,
      showPreMarket: true,
      showAfterHours: true,
      visualMode: "merged" as const,
      colorScheme: "dimmed" as const,
    },
    preMarketLevels: {
      showPMHigh: true,
      showPMLow: true,
      showPMOpen: false,
      showPMVWAP: false,
      extendIntoRTH: true,
      daysToShow: 1,
    },
    linkGroup: "none" as const,
  };
}

describe("workstationTickerBridge", () => {
  beforeEach(() => {
    registerWorkstationLinkedPropagator(null);
    useChartWorkstationStore.setState({
      slots: [baseSlot("slot-1")],
      activeSlotId: null,
      gridTemplate: { cols: 1, rows: 1, arrangement: "grid" },
      syncCrosshair: true,
      syncTimeframe: false,
    });
    useStockStore.setState({ ticker: "SPY" });
  });

  afterEach(() => {
    registerWorkstationLinkedPropagator(null);
  });

  it("detects chart workstation paths", () => {
    expect(isChartWorkstationPath("/equity/chart-workstation")).toBe(true);
    expect(isChartWorkstationPath("/equity/screener")).toBe(false);
  });

  it("infers IN market for Indian exchanges", () => {
    expect(inferSlotMarket("NSE")).toBe("IN");
    expect(inferSlotMarket("NASDAQ")).toBe("US");
  });

  it("routes header ticker selection into the active pane and stock store", () => {
    const result = applyTickerToActiveWorkstationPane("aapl", { companyName: "Apple Inc." });
    expect(result?.ticker).toBe("AAPL");
    const state = useChartWorkstationStore.getState();
    expect(state.activeSlotId).toBe("slot-1");
    expect(state.slots[0]?.ticker).toBe("AAPL");
    expect(useStockStore.getState().ticker).toBe("AAPL");
  });

  it("invokes linked-symbol propagator after pane update", () => {
    const propagate = vi.fn();
    registerWorkstationLinkedPropagator(propagate);
    applyTickerToActiveWorkstationPane("MSFT", { companyName: "Microsoft" });
    expect(propagate).toHaveBeenCalledWith("slot-1", "MSFT", "US", "Microsoft");
  });

  it("seeds an empty active pane from the preferred or stock-store ticker", () => {
    useStockStore.setState({ ticker: "AAPL" });
    const seeded = seedActiveWorkstationPaneIfEmpty();
    expect(seeded?.ticker).toBe("AAPL");
    expect(useChartWorkstationStore.getState().slots[0]?.ticker).toBe("AAPL");
  });

  it("does not overwrite an existing pane ticker when seeding", () => {
    useChartWorkstationStore.getState().updateSlotTicker("slot-1", "TSLA", "US");
    expect(seedActiveWorkstationPaneIfEmpty("AAPL")).toBeNull();
    expect(useChartWorkstationStore.getState().slots[0]?.ticker).toBe("TSLA");
  });

  it("syncs stock ticker from the active workstation pane", () => {
    useChartWorkstationStore.getState().updateSlotTicker("slot-1", "MSFT", "US", "Microsoft");
    useChartWorkstationStore.getState().setActiveSlot("slot-1");
    expect(syncStockTickerFromActiveWorkstationPane()).toBe("MSFT");
    expect(useStockStore.getState().ticker).toBe("MSFT");
  });
});
