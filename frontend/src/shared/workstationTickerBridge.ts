import { useChartWorkstationStore, type SlotMarket } from "../store/chartWorkstationStore";
import { useStockStore } from "../store/stockStore";
import { normalizeTicker } from "../utils/ticker";

function inferSlotMarket(exchange?: string | null): SlotMarket {
  const raw = String(exchange || "").toUpperCase();
  if (raw === "IN" || raw === "NSE" || raw === "BSE" || raw === "NFO") return "US";
  return "US";
}

/**
 * Apply a header/global ticker selection into the active chart workstation pane.
 * Ensures an active slot exists, updates the pane ticker, and keeps stock store in sync.
 */
export function applyTickerToActiveWorkstationPane(
  ticker: string,
  options?: { market?: SlotMarket; companyName?: string | null; exchange?: string | null },
): { slotId: string; ticker: string } | null {
  const symbol = normalizeTicker(ticker);
  if (!symbol) return null;

  const store = useChartWorkstationStore.getState();
  const targetId = store.activeSlotId ?? store.slots[0]?.id ?? null;
  if (!targetId) return null;

  if (store.activeSlotId !== targetId) {
    store.setActiveSlot(targetId);
  }

  const market = options?.market ?? inferSlotMarket(options?.exchange);
  store.updateSlotTicker(targetId, symbol, market, options?.companyName ?? null);
  useStockStore.getState().setTicker(symbol);
  return { slotId: targetId, ticker: symbol };
}

export function syncStockTickerFromActiveWorkstationPane(): string | null {
  const store = useChartWorkstationStore.getState();
  const active = store.slots.find((slot) => slot.id === store.activeSlotId) ?? store.slots[0] ?? null;
  const ticker = active?.ticker ? normalizeTicker(active.ticker) : null;
  if (ticker) {
    useStockStore.getState().setTicker(ticker);
  }
  return ticker;
}

export function isChartWorkstationPath(pathname: string): boolean {
  return pathname.includes("/equity/chart-workstation");
}
