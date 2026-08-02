import { useMemo } from "react";

import { useNetworkStatus } from "./useNetworkStatus";
import { useMarketStatus } from "./useStocks";
import { useQuotesStore } from "../realtime/useQuotesStream";
import { useUSQuotesStore } from "../realtime/useUsQuotesStream";
import {
  feedStateDetail,
  feedStateLabel,
  feedStateTone,
  resolveFeedState,
  type FeedState,
  type FeedStateInput,
} from "../shared/feedState";

function marketIsOpen(value: unknown): boolean {
  return String(value || "").toUpperCase().includes("OPEN");
}

export type UseFeedStateResult = {
  state: FeedState;
  label: string;
  tone: ReturnType<typeof feedStateTone>;
  detail: string | null;
  input: FeedStateInput;
};

/**
 * Single feed-state consumer for Home, status bar, chart shell, and options.
 * Assembles shared inputs so surfaces cannot disagree on Live vs Offline.
 */
export function useFeedState(overrides?: Partial<FeedStateInput>): UseFeedStateResult {
  const { online } = useNetworkStatus();
  const { data: marketStatus } = useMarketStatus();
  const nseConnection = useQuotesStore((s) => s.connectionState);
  const ticksByToken = useQuotesStore((s) => s.ticksByToken);
  const usConnection = useUSQuotesStore((s) => s.connectionState);
  const usLastMessageAt = useUSQuotesStore((s) => s.lastMessageAt);

  const marketPayload = (marketStatus ?? {}) as {
    marketState?: Array<{ marketStatus?: string }>;
    nseStatus?: string;
    nyseStatus?: string;
    fallbackEnabled?: boolean;
  };

  const nseOpen = marketIsOpen(marketPayload.marketState?.[0]?.marketStatus ?? marketPayload.nseStatus);
  const nyseOpen = marketIsOpen(marketPayload.nyseStatus);

  const connectionState =
    nseConnection === "connected" || usConnection === "connected"
      ? "connected"
      : nseConnection === "connecting" || usConnection === "connecting"
        ? "connecting"
        : "disconnected";

  const { hasQuotes, lastUpdateAgeMs } = useMemo(() => {
    const now = Date.now();
    let newest = 0;
    for (const tick of Object.values(ticksByToken)) {
      const ts = Date.parse(String(tick.ts || ""));
      if (Number.isFinite(ts) && ts > newest) newest = ts;
    }
    if (typeof usLastMessageAt === "number" && usLastMessageAt > newest) {
      newest = usLastMessageAt;
    }
    return {
      hasQuotes: Object.keys(ticksByToken).length > 0 || usLastMessageAt != null,
      lastUpdateAgeMs: newest > 0 ? now - newest : null,
    };
  }, [ticksByToken, usLastMessageAt]);

  const input: FeedStateInput = {
    online,
    connectionState,
    marketOpen: nyseOpen || nseOpen,
    fallbackEnabled: Boolean(marketPayload.fallbackEnabled),
    hasQuotes,
    lastUpdateAgeMs,
    ...overrides,
  };

  const state = resolveFeedState(input);
  return {
    state,
    label: feedStateLabel(state),
    tone: feedStateTone(state),
    detail: feedStateDetail(state, input),
    input,
  };
}
