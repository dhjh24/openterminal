import { describe, expect, it, beforeEach } from "vitest";

import { useChartWorkstationStore } from "../store/chartWorkstationStore";
import { useStockStore } from "../store/stockStore";
import {
  applyTickerToActiveWorkstationPane,
  isChartWorkstationPath,
  syncStockTickerFromActiveWorkstationPane,
} from "../shared/workstationTickerBridge";

describe("workstationTickerBridge", () => {
  beforeEach(() => {
    useChartWorkstationStore.setState({
      slots: [
        {
          id: "slot-1",
          ticker: null,
          companyName: null,
          market: "US",
          timeframe: "1D",
          chartType: "candle",
          indicators: [],
          extendedHours: {
            enabled: false,
            showPreMarket: true,
            showAfterHours: true,
            visualMode: "merged",
            colorScheme: "dimmed",
          },
          preMarketLevels: {
            showPMHigh: true,
            showPMLow: true,
            showPMOpen: false,
            showPMVWAP: false,
            extendIntoRTH: true,
            daysToShow: 1,
          },
          linkGroup: "none",
        },
      ],
      activeSlotId: null,
      gridTemplate: { cols: 1, rows: 1, arrangement: "grid" },
      syncCrosshair: true,
      syncTimeframe: false,
    });
    useStockStore.setState({ ticker: "SPY" });
  });

  it("detects chart workstation paths", () => {
    expect(isChartWorkstationPath("/equity/chart-workstation")).toBe(true);
    expect(isChartWorkstationPath("/equity/screener")).toBe(false);
  });

  it("routes header ticker selection into the active pane and stock store", () => {
    const result = applyTickerToActiveWorkstationPane("aapl", { companyName: "Apple Inc." });
    expect(result?.ticker).toBe("AAPL");
    const state = useChartWorkstationStore.getState();
    expect(state.activeSlotId).toBe("slot-1");
    expect(state.slots[0]?.ticker).toBe("AAPL");
    expect(useStockStore.getState().ticker).toBe("AAPL");
  });

  it("syncs stock ticker from the active workstation pane", () => {
    useChartWorkstationStore.getState().updateSlotTicker("slot-1", "MSFT", "US", "Microsoft");
    useChartWorkstationStore.getState().setActiveSlot("slot-1");
    expect(syncStockTickerFromActiveWorkstationPane()).toBe("MSFT");
    expect(useStockStore.getState().ticker).toBe("MSFT");
  });
});
