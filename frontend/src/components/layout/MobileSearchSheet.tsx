import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";

import { searchSymbols, type SearchSymbolItem } from "../../api/client";
import { inferRecentSecurityAssetClass, inferRecentSecurityMarket, useRecentSecurities } from "../../hooks/useRecentSecurities";
import { useSettingsStore } from "../../store/settingsStore";
import { useStockStore } from "../../store/stockStore";
import { COMMAND_FUNCTIONS, executeParsedCommand, parseCommand } from "./commanding";
import { MobileBottomSheet } from "./MobileBottomSheet";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Row =
  | { kind: "recent"; key: string; symbol: string; name: string }
  | { kind: "symbol"; key: string; item: SearchSymbolItem }
  | { kind: "command"; key: string; code: string; label: string; description: string }
  | { kind: "page"; key: string; label: string; path: string; description: string };

const PAGE_SUGGESTIONS: Array<{ label: string; path: string; description: string; aliases: string[] }> = [
  { label: "Home", path: "/home", description: "Mission Control", aliases: ["home", "desk"] },
  { label: "Watchlist", path: "/equity/watchlist", description: "Saved symbols", aliases: ["watch", "wl"] },
  { label: "Stocks", path: "/equity/stocks", description: "Equity search", aliases: ["stocks", "quote"] },
  { label: "Options", path: "/fno", description: "Option chain", aliases: ["options", "opt"] },
  { label: "Chart Workstation", path: "/equity/chart-workstation", description: "Charts", aliases: ["chart", "workstation"] },
  { label: "Portfolio", path: "/equity/portfolio", description: "Holdings", aliases: ["portfolio", "pf"] },
  { label: "News", path: "/equity/news", description: "Market news", aliases: ["news"] },
  { label: "Alerts", path: "/equity/alerts", description: "Price alerts", aliases: ["alerts"] },
  { label: "Screener", path: "/equity/screener", description: "Equity screener", aliases: ["screener"] },
  { label: "Settings", path: "/equity/settings", description: "Preferences", aliases: ["settings"] },
];

export function MobileSearchSheet({ open, onClose }: Props) {
  const navigate = useNavigate();
  const setTicker = useStockStore((s) => s.setTicker);
  const load = useStockStore((s) => s.load);
  const selectedMarket = useSettingsStore((s) => s.selectedMarket);
  const selectedCountry = useSettingsStore((s) => s.selectedCountry);
  const { recentSecurities, addRecent } = useRecentSecurities();
  const [query, setQuery] = useState("");
  const [symbols, setSymbols] = useState<SearchSymbolItem[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSymbols([]);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setSymbols([]);
      return;
    }
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(() => {
      void searchSymbols(q, selectedMarket)
        .then((items) => {
          if (requestRef.current !== requestId) return;
          setSymbols(Array.isArray(items) ? items.slice(0, 12) : []);
        })
        .catch(() => {
          if (requestRef.current !== requestId) return;
          setSymbols([]);
        });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, selectedMarket]);

  const rows = useMemo((): Row[] => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return recentSecurities.slice(0, 8).map((item) => ({
        kind: "recent" as const,
        key: `recent:${item.symbol}`,
        symbol: item.symbol,
        name: item.name,
      }));
    }

    const out: Row[] = [];
    for (const item of symbols) {
      out.push({ kind: "symbol", key: `sym:${item.ticker}:${item.exchange}`, item });
    }
    for (const fn of COMMAND_FUNCTIONS) {
      const hay = [fn.code, fn.label, ...(fn.aliases ?? [])].join(" ").toLowerCase();
      if (hay.includes(q) || q.includes(fn.code.toLowerCase())) {
        out.push({
          kind: "command",
          key: `cmd:${fn.code}`,
          code: fn.code,
          label: fn.label,
          description: fn.description,
        });
      }
    }
    for (const page of PAGE_SUGGESTIONS) {
      const hay = [page.label, ...page.aliases].join(" ").toLowerCase();
      if (hay.includes(q)) {
        out.push({
          kind: "page",
          key: `page:${page.path}`,
          label: page.label,
          path: page.path,
          description: page.description,
        });
      }
    }
    return out.slice(0, 20);
  }, [query, recentSecurities, symbols]);

  const selectSymbol = useCallback(
    async (symbol: string, name?: string, exchange?: string) => {
      const normalized = symbol.trim().toUpperCase();
      if (!normalized) return;
      setTicker(normalized);
      addRecent(
        normalized,
        name || normalized,
        inferRecentSecurityAssetClass(normalized, exchange),
        inferRecentSecurityMarket(selectedCountry, exchange || selectedMarket),
      );
      await load();
      navigate(`/equity/stocks?symbol=${encodeURIComponent(normalized)}`);
      onClose();
    },
    [addRecent, load, navigate, onClose, selectedCountry, selectedMarket, setTicker],
  );

  const runQuery = useCallback(async () => {
    const raw = query.trim();
    if (!raw) return;
    const parsed = parseCommand(raw);
    if (parsed.kind === "ticker") {
      await selectSymbol(parsed.ticker);
      return;
    }
    const result = executeParsedCommand(parsed, navigate);
    if (result.ok) {
      onClose();
      return;
    }
    // Fallback: treat as ticker
    await selectSymbol(raw.split(/\s+/)[0] || raw);
  }, [navigate, onClose, query, selectSymbol]);

  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      title="Search"
      maxHeightClassName="max-h-[65dvh]"
      aboveBottomNav
      testId="mobile-search-sheet"
    >
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2 rounded border border-terminal-border bg-terminal-bg px-2">
          <Search size={18} className="shrink-0 text-terminal-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void runQuery();
              }
            }}
            placeholder="Stocks, commands, pages"
            className="min-h-11 w-full bg-transparent text-base text-terminal-text outline-none placeholder:text-terminal-muted"
            aria-label="Search stocks, commands, and pages"
            data-testid="mobile-search-input"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-terminal-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
              aria-label="Clear search"
            >
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {!query.trim() ? (
          <div className="text-xs font-medium uppercase tracking-wide text-terminal-muted">Recent</div>
        ) : null}

        <ul className="flex flex-col gap-1" role="listbox" aria-label="Search results">
          {rows.map((row) => {
            if (row.kind === "recent") {
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    role="option"
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded border border-terminal-border px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
                    onClick={() => void selectSymbol(row.symbol, row.name)}
                  >
                    <span className="font-mono text-base font-semibold text-terminal-text">{row.symbol}</span>
                    <span className="truncate text-sm text-terminal-muted">{row.name}</span>
                  </button>
                </li>
              );
            }
            if (row.kind === "symbol") {
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    role="option"
                    className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded border border-terminal-border px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
                    onClick={() => void selectSymbol(row.item.ticker, row.item.name, row.item.exchange)}
                  >
                    <span className="font-mono text-base font-semibold text-terminal-text">{row.item.ticker}</span>
                    <span className="truncate text-sm text-terminal-muted">
                      {row.item.name}
                      {row.item.exchange ? ` · ${row.item.exchange}` : ""}
                    </span>
                  </button>
                </li>
              );
            }
            if (row.kind === "command") {
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    role="option"
                    className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded border border-terminal-border px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
                    onClick={() => {
                      const result = executeParsedCommand(parseCommand(row.code), navigate);
                      void Promise.resolve(result).then((res) => {
                        if (res.ok) onClose();
                      });
                    }}
                  >
                    <span className="text-base font-semibold text-terminal-accent">{row.code}</span>
                    <span className="text-sm text-terminal-muted">
                      {row.label} — {row.description}
                    </span>
                  </button>
                </li>
              );
            }
            return (
              <li key={row.key}>
                <button
                  type="button"
                  role="option"
                  className="flex min-h-11 w-full flex-col items-start gap-0.5 rounded border border-terminal-border px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
                  onClick={() => {
                    navigate(row.path);
                    onClose();
                  }}
                >
                  <span className="text-base font-semibold text-terminal-text">{row.label}</span>
                  <span className="text-sm text-terminal-muted">{row.description}</span>
                </button>
              </li>
            );
          })}
          {query.trim() && rows.length === 0 ? (
            <li className="px-2 py-4 text-sm text-terminal-muted">No matches. Press Search to open as a ticker.</li>
          ) : null}
        </ul>
      </div>
    </MobileBottomSheet>
  );
}
