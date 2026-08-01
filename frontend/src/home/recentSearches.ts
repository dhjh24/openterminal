export const RECENT_SEARCHES_STORAGE_KEY = "ot:mobile:recent-searches:v1";
const MAX_RECENT = 8;

export type RecentSearch = {
  query: string;
  at: number;
};

function isRecentSearch(value: unknown): value is RecentSearch {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.query === "string" && row.query.trim().length > 0 && typeof row.at === "number";
}

export function readRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentSearch).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function recordRecentSearch(query: string): RecentSearch[] {
  if (typeof window === "undefined") return [];
  const normalized = query.trim();
  if (!normalized) return readRecentSearches();
  const next: RecentSearch[] = [
    { query: normalized, at: Date.now() },
    ...readRecentSearches().filter((item) => item.query.toLowerCase() !== normalized.toLowerCase()),
  ].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
