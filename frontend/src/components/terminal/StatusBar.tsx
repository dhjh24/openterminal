import { useEffect, useMemo, useState } from "react";

import { useMarketStatus } from "../../hooks/useStocks";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { useQuotesStore } from "../../realtime/useQuotesStream";
import { useSettingsStore } from "../../store/settingsStore";
import { useStockStore } from "../../store/stockStore";
import { APP_VERSION } from "../../utils/constants";
import { feedStateLabel, resolveFeedState } from "../../shared/feedState";
import { TerminalBadge } from "./TerminalBadge";

function nowLabel(now: Date): string {
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return `${time} ${tz}`;
}

type Props = {
  tickerOverride?: string | null;
};

export function StatusBar({ tickerOverride }: Props) {
  const selectedMarket = useSettingsStore((s) => s.selectedMarket);
  const displayCurrency = useSettingsStore((s) => s.displayCurrency);
  const tickerFromStore = useStockStore((s) => s.ticker);
  const stockLoading = useStockStore((s) => s.loading);
  const stockError = useStockStore((s) => s.error);
  const connectionState = useQuotesStore((s) => s.connectionState);
  const { online } = useNetworkStatus();
  const {
    data: marketStatus,
    isLoading: marketLoading,
    isFetching: marketFetching,
    error: marketError,
  } = useMarketStatus();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isMock = useMemo(() => {
    const payload = marketStatus as { fallbackEnabled?: boolean; error?: string } | undefined;
    return Boolean(payload?.fallbackEnabled) || Boolean(payload?.error);
  }, [marketStatus]);

  const marketPayload = (marketStatus ?? {}) as {
    marketState?: Array<{ marketStatus?: string }>;
    nyseStatus?: string;
    fallbackEnabled?: boolean;
  };
  const nyseRaw = String(marketPayload.nyseStatus || marketPayload.marketState?.[0]?.marketStatus || "").toUpperCase();
  const marketOpen = nyseRaw.includes("OPEN") ? true : nyseRaw.includes("CLOSE") ? false : null;

  const dataState = useMemo(() => {
    if (marketError || stockError) {
      return { label: "ERROR", variant: "warn" as const };
    }
    if (stockLoading) {
      return { label: "LOADING", variant: "mock" as const };
    }
    if (marketFetching || (marketLoading && !marketStatus)) {
      return { label: "POLLING", variant: "mock" as const };
    }
    const feed = resolveFeedState({
      online,
      connectionState,
      marketOpen,
      fallbackEnabled: isMock,
      hasQuotes: Boolean(marketStatus),
    });
    const variant =
      feed === "Live"
        ? ("live" as const)
        : feed === "Offline"
          ? ("neutral" as const)
          : feed === "Closed"
            ? ("neutral" as const)
            : ("mock" as const);
    return { label: feedStateLabel(feed).toUpperCase(), variant };
  }, [
    connectionState,
    isMock,
    marketError,
    marketFetching,
    marketLoading,
    marketOpen,
    marketStatus,
    online,
    stockError,
    stockLoading,
  ]);
  const ticker = (tickerOverride || tickerFromStore || "").toUpperCase();

  return (
    <div className="border-t border-terminal-border bg-terminal-panel px-3 py-1 text-[11px] uppercase tracking-wide text-terminal-muted">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span>{selectedMarket}</span>
          <span>{displayCurrency}</span>
          <span>{ticker || "NO-SYMBOL"}</span>
          <TerminalBadge variant={isMock ? "mock" : "live"}>{isMock ? "DELAYED" : "LIVE"}</TerminalBadge>
          <span className="tabular-nums">{nowLabel(now)}</span>
        </div>
        <div className="flex items-center gap-2 border-l border-terminal-border pl-2">
          <span className="rounded border border-terminal-border px-1.5 py-0.5 ot-type-label-compact text-terminal-accent">
            OpenTerminalUI V{APP_VERSION}
          </span>
          <span>DATA</span>
          <TerminalBadge variant={dataState.variant}>{dataState.label}</TerminalBadge>
        </div>
      </div>
    </div>
  );
}
