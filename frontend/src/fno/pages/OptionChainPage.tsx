import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetchChainSummary, fetchOptionChain } from "../api/fnoApi";
import { OptionChainTable } from "../components/OptionChainTable";
import { OIChart } from "../components/OIChart";
import { StrikeSummaryBar } from "../components/StrikeSummaryBar";
import { useFnoContext } from "../FnoLayout";
import type { StrikeData } from "../types/fno";

export function OptionChainPage() {
  const { symbol, expiry } = useFnoContext();
  const [rangeFilter, setRangeFilter] = useState<10 | 15 | 20 | 0>(20);

  const hasExpiry = Boolean(expiry);
  const backendRange = rangeFilter === 0 ? 100 : rangeFilter;

  const chainQuery = useQuery({
    queryKey: ["fno-chain", symbol, expiry, backendRange],
    queryFn: () => fetchOptionChain(symbol, expiry || undefined, backendRange),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: hasExpiry,
  });

  const summaryQuery = useQuery({
    queryKey: ["fno-summary", symbol, expiry],
    queryFn: () => fetchChainSummary(symbol, expiry || undefined),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: hasExpiry,
  });

  const chain = chainQuery.data;
  const rows = useMemo(() => {
    if (!hasExpiry) return [];
    const list = (chain?.strikes ?? []) as StrikeData[];
    if (!list.length || rangeFilter === 0) return list;
    const atm = Number(chain?.atm_strike || 0);
    const idx = Math.max(0, list.findIndex((r) => Math.abs(Number(r.strike_price) - atm) < 1e-9));
    const left = Math.max(0, idx - rangeFilter);
    const right = Math.min(list.length, idx + rangeFilter + 1);
    return list.slice(left, right);
  }, [chain?.strikes, chain?.atm_strike, rangeFilter, hasExpiry]);

  return (
    <div className="space-y-3">
      {/* Summary card — always visible, shows em dashes when no expiry */}
      <StrikeSummaryBar
        symbol={symbol}
        expiry={expiry}
        spotPrice={hasExpiry ? Number(chain?.spot_price || 0) : 0}
        summary={hasExpiry ? summaryQuery.data : undefined}
      />

      {/* Strike range filter — only show when data loaded */}
      {hasExpiry && rows.length > 0 ? (
        <div className="flex items-center gap-2 rounded border border-terminal-border bg-terminal-panel px-3 py-2 text-xs">
          <span className="uppercase text-terminal-muted">Strike Range</span>
          {([10, 15, 20, 0] as const).map((r) => (
            <button
              key={String(r)}
              type="button"
              className={`min-h-11 rounded border px-3 py-2 text-xs ${rangeFilter === r ? "border-terminal-accent text-terminal-accent" : "border-terminal-border text-terminal-muted"}`}
              onClick={() => setRangeFilter(r)}
            >
              {r === 0 ? "All" : `±${r}`}
            </button>
          ))}
          <div className="ml-auto hidden text-[11px] text-terminal-muted lg:block">
            Select Last to choose a contract · Paper Buy Call/Put below · ▲ ATM
          </div>
        </div>
      ) : null}

      {/* No-expiry empty state */}
      {!hasExpiry ? (
        <div className="flex flex-col items-center justify-center rounded border border-terminal-border bg-terminal-panel/60 px-4 py-10 text-center">
          <p className="text-sm font-semibold text-terminal-muted">No expiry selected</p>
          <p className="mt-1 text-xs text-terminal-muted/70">Select an expiry to view options data</p>
        </div>
      ) : null}

      {/* Loading state */}
      {hasExpiry && chainQuery.isLoading && !chainQuery.isFetching ? (
        <div className="rounded border border-terminal-border bg-terminal-panel p-3 text-xs text-terminal-muted">Loading option chain...</div>
      ) : null}

      {/* Refreshing indicator (shown during background refetch) */}
      {hasExpiry && chainQuery.isFetching && !chainQuery.isLoading ? (
        <div className="rounded border border-terminal-border bg-terminal-panel p-2 text-[10px] text-terminal-muted">Refreshing...</div>
      ) : null}

      {/* Error state */}
      {hasExpiry && chainQuery.isError ? (
        <div className="rounded border border-terminal-neg bg-terminal-neg/10 p-3 text-xs text-terminal-neg">Failed to load option chain</div>
      ) : null}

      {/* Data loaded */}
      {hasExpiry && !chainQuery.isLoading && !chainQuery.isError && chainQuery.data ? (
        <>
          <OptionChainTable
            rows={rows}
            atmStrike={Number(chain?.atm_strike || 0)}
            underlying={symbol}
            expiry={expiry}
            dataTimestamp={chain?.timestamp}
          />
          <OIChart rows={rows} title="OI Distribution By Strike" />
        </>
      ) : null}
    </div>
  );
}
