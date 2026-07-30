export const WATCHLIST_SNAPSHOT_KEY = "otui:watchlist-snapshot:v1";

export type WatchlistSnapshotQuote = {
  symbol: string;
  ltp?: number | null;
  change_pct?: number | null;
};

export type WatchlistSnapshot = {
  savedAt: string;
  market: string;
  watchlistId: string | null;
  watchlistName: string | null;
  symbols: string[];
  quotes: WatchlistSnapshotQuote[];
};

export function saveWatchlistSnapshot(snapshot: WatchlistSnapshot): void {
  try {
    localStorage.setItem(WATCHLIST_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota / private mode
  }
}

export function loadWatchlistSnapshot(): WatchlistSnapshot | null {
  try {
    const raw = localStorage.getItem(WATCHLIST_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WatchlistSnapshot;
    if (!parsed?.savedAt || !Array.isArray(parsed.symbols)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearWatchlistSnapshot(): void {
  try {
    localStorage.removeItem(WATCHLIST_SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}
