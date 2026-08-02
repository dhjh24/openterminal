/**
 * Shared market/data feed language used across Home, chart, options, and status chrome.
 * Keep labels stable — surfaces must not mix reassuring copy with Offline.
 */
export const FEED_STATES = ["Live", "Delayed", "Cached", "Closed", "Offline"] as const;

export type FeedState = (typeof FEED_STATES)[number];

export type QuotesConnectionLike = "connected" | "connecting" | "disconnected" | string;

export type FeedStateInput = {
  /** Browser / network reachability. Defaults to true when omitted. */
  online?: boolean;
  /** Realtime quote stream connection. */
  connectionState?: QuotesConnectionLike | null;
  /** Session open when known; null/undefined means unknown. */
  marketOpen?: boolean | null;
  /** Provider fell back to delayed/mock/cached path. */
  fallbackEnabled?: boolean;
  /** Explicit delayed flag from option/quote payloads. */
  delayed?: boolean;
  /** At least one usable quote/row is present locally. */
  hasQuotes?: boolean;
  /** Age of newest quote/snapshot in ms; null when unknown. */
  lastUpdateAgeMs?: number | null;
};

const LIVE_MAX_AGE_MS = 15_000;
const DELAYED_MAX_AGE_MS = 120_000;

function isConnected(state: QuotesConnectionLike | null | undefined): boolean {
  const raw = String(state || "").toLowerCase();
  return raw === "connected" || raw === "live" || raw.includes("live");
}

function isConnecting(state: QuotesConnectionLike | null | undefined): boolean {
  const raw = String(state || "").toLowerCase();
  return raw === "connecting" || raw === "degraded";
}

/**
 * Resolve a single canonical feed state.
 * Priority: Offline > Closed > Cached > Delayed > Live.
 */
export function resolveFeedState(input: FeedStateInput = {}): FeedState {
  const online = input.online !== false;
  if (!online) return "Offline";

  if (input.marketOpen === false) {
    if (input.hasQuotes || (input.lastUpdateAgeMs != null && Number.isFinite(input.lastUpdateAgeMs))) {
      return "Closed";
    }
    if (!isConnected(input.connectionState) && !isConnecting(input.connectionState)) {
      return "Offline";
    }
    return "Closed";
  }

  if (input.fallbackEnabled || input.delayed) {
    return input.hasQuotes === false && !isConnected(input.connectionState) ? "Offline" : "Delayed";
  }

  const age = input.lastUpdateAgeMs;
  if (typeof age === "number" && Number.isFinite(age)) {
    if (age > DELAYED_MAX_AGE_MS) return input.hasQuotes ? "Cached" : "Offline";
    if (age > LIVE_MAX_AGE_MS) return "Delayed";
  }

  if (isConnected(input.connectionState)) {
    return "Live";
  }

  if (isConnecting(input.connectionState)) {
    return input.hasQuotes ? "Cached" : "Delayed";
  }

  if (input.hasQuotes) {
    return "Cached";
  }

  return "Offline";
}

export function feedStateLabel(state: FeedState): string {
  return state;
}

export function feedStateTone(state: FeedState): "green" | "yellow" | "red" | "gray" {
  switch (state) {
    case "Live":
      return "green";
    case "Delayed":
      return "yellow";
    case "Cached":
      return "yellow";
    case "Closed":
      return "gray";
    case "Offline":
      return "red";
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

/** Short explanation when Offline coexists with local quote rows. */
export function feedStateDetail(state: FeedState, input: FeedStateInput = {}): string | null {
  if (state === "Offline" && input.hasQuotes) {
    return "Quotes cached — stream disconnected";
  }
  if (state === "Cached") {
    return "Showing last known quotes";
  }
  if (state === "Delayed" && input.fallbackEnabled) {
    return "Fallback feed";
  }
  if (state === "Closed") {
    return "Market closed";
  }
  return null;
}
