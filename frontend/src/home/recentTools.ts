import { findNavCardByRoute } from "./navCards";

export const RECENT_TOOLS_STORAGE_KEY = "ot:home:recent-tools:v1";
const MAX_RECENT = 6;

export type RecentTool = {
  to: string;
  label: string;
  at: number;
};

function isRecentTool(value: unknown): value is RecentTool {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.to === "string" && typeof row.label === "string" && typeof row.at === "number";
}

export function readRecentTools(): RecentTool[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_TOOLS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentTool).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function recordRecentTool(to: string, label?: string): RecentTool[] {
  if (typeof window === "undefined") return [];
  const resolvedLabel = label || findNavCardByRoute(to)?.label || to;
  const next: RecentTool[] = [
    { to, label: resolvedLabel, at: Date.now() },
    ...readRecentTools().filter((item) => item.to !== to),
  ].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_TOOLS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
  return next;
}
