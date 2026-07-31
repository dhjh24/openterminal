import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";

import { searchSymbols, type SearchSymbolItem } from "../../api/client";
import { useRecentSecurities } from "../../hooks/useRecentSecurities";
import { useSettingsStore } from "../../store/settingsStore";
import { useStockStore } from "../../store/stockStore";
import { parseCommand, executeParsedCommand } from "./commanding";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Suggestion =
  | { kind: "symbol"; item: SearchSymbolItem }
  | { kind: "recent"; symbol: string; name?: string }
  | { kind: "page"; label: string; path: string }
  | { kind: "command"; label: string; command: string };

const PAGE_SHORTCUTS: Array<{ label: string; path: string; keywords: string }> = [
  { label: "Home", path: "/home", keywords: "home mission" },
  { label: "Watchlist", path: "/equity/watchlist", keywords: "watch list" },
  { label: "Stocks", path: "/equity/stocks", keywords: "stocks quote search" },
  { label: "Chart Workstation", path: "/equity/chart-workstation", keywords: "chart workstation" },
  { label: "Options", path: "/fno", keywords: "options chain" },
  { label: "Options Heatmap", path: "/fno/heatmap", keywords: "heatmap oi" },
  { label: "Portfolio", path: "/equity/portfolio", keywords: "portfolio holdings" },
  { label: "News", path: "/equity/news", keywords: "news" },
  { label: "Alerts", path: "/equity/alerts", keywords: "alerts" },
  { label: "Screener", path: "/equity/screener", keywords: "screener filter" },
  { label: "Settings", path: "/equity/settings", keywords: "settings" },
];

export function MobileSearchSheet({ open, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSymbolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const selectedMarket = useSettingsStore((s) => s.selectedMarket);
  const setTicker = useStockStore((s) => s.setTicker);
  const load = useStockStore((s) => s.load);
  const { recentSecurities, addRecent } = useRecentSecurities();
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void searchSymbols(q, selectedMarket || "NASDAQ")
        .then((items) => {
          if (requestId.current !== id) return;
          setResults(items.slice(0, 12));
        })
        .catch(() => {
          if (requestId.current !== id) return;
          setResults([]);
        })
        .finally(() => {
          if (requestId.current === id) setLoading(false);
        });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [open, query, selectedMarket]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return recentSecurities.slice(0, 8).map((r) => ({
        kind: "recent" as const,
        symbol: r.symbol,
        name: r.name,
      }));
    }
    const pages = PAGE_SHORTCUTS.filter(
      (p) => p.label.toLowerCase().includes(q) || p.keywords.includes(q),
    ).map((p) => ({ kind: "page" as const, label: p.label, path: p.path }));
    const symbols = results.map((item) => ({ kind: "symbol" as const, item }));
    const commands: Suggestion[] =
      q.length >= 2
        ? [{ kind: "command", label: `Run “${query.trim()}”`, command: query.trim() }]
        : [];
    return [...symbols, ...pages, ...commands].slice(0, 16);
  }, [query, recentSecurities, results]);

  const selectSymbol = useCallback(
    async (symbol: string, name?: string) => {
      const next = symbol.trim().toUpperCase();
      if (!next) return;
      setTicker(next);
      addRecent(next, name || next, "equity", "US");
      void load();
      onClose();
      navigate(`/equity/stocks/${encodeURIComponent(next)}`);
    },
    [addRecent, load, navigate, onClose, setTicker],
  );

  const onSubmit = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    if (results[0]?.ticker) {
      await selectSymbol(results[0].ticker, results[0].name);
      return;
    }
    const parsed = parseCommand(q);
    await executeParsedCommand(parsed, navigate);
    onClose();
  }, [navigate, onClose, query, results, selectSymbol]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Search">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close search"
        onClick={onClose}
      />
      <div
        className="ot-mobile-search-sheet absolute bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] left-0 right-0 mx-auto flex max-h-[65dvh] w-full max-w-lg flex-col rounded-t-xl border border-terminal-border bg-terminal-panel shadow-2xl"
        data-testid="mobile-search-sheet"
      >
        <div className="flex items-center gap-2 border-b border-terminal-border px-3 py-2">
          <Search size={18} className="shrink-0 text-terminal-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-terminal-text outline-none placeholder:text-terminal-muted"
            placeholder="Search stocks, pages, commands"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onSubmit();
              }
              if (e.key === "Escape") onClose();
            }}
            aria-label="Search"
          />
          {query ? (
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center text-terminal-muted"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="min-h-11 rounded-sm border border-terminal-border px-3 text-sm text-terminal-muted"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {!query ? (
            <div className="px-2 pb-2 text-[12px] uppercase tracking-wide text-terminal-muted">Recent</div>
          ) : null}
          {loading ? (
            <div className="px-3 py-4 text-sm text-terminal-muted">Searching…</div>
          ) : null}
          {!loading && suggestions.length === 0 ? (
            <div className="px-3 py-4 text-sm text-terminal-muted">No matches</div>
          ) : null}
          <ul className="space-y-1">
            {suggestions.map((s, idx) => {
              if (s.kind === "symbol") {
                return (
                  <li key={`sym-${s.item.ticker}-${idx}`}>
                    <button
                      type="button"
                      className="flex min-h-12 w-full items-center justify-between rounded-md border border-terminal-border px-3 py-2 text-left hover:border-terminal-accent"
                      onClick={() => void selectSymbol(s.item.ticker, s.item.name)}
                    >
                      <span className="text-base font-semibold text-terminal-text">{s.item.ticker}</span>
                      <span className="truncate pl-3 text-sm text-terminal-muted">{s.item.name}</span>
                    </button>
                  </li>
                );
              }
              if (s.kind === "recent") {
                return (
                  <li key={`rec-${s.symbol}`}>
                    <button
                      type="button"
                      className="flex min-h-12 w-full items-center justify-between rounded-md border border-terminal-border px-3 py-2 text-left hover:border-terminal-accent"
                      onClick={() => void selectSymbol(s.symbol, s.name)}
                    >
                      <span className="text-base font-semibold text-terminal-text">{s.symbol}</span>
                      <span className="truncate pl-3 text-sm text-terminal-muted">{s.name || "Recent"}</span>
                    </button>
                  </li>
                );
              }
              if (s.kind === "page") {
                return (
                  <li key={`page-${s.path}`}>
                    <button
                      type="button"
                      className="flex min-h-12 w-full items-center rounded-md border border-terminal-border px-3 py-2 text-left text-base text-terminal-text hover:border-terminal-accent"
                      onClick={() => {
                        onClose();
                        navigate(s.path);
                      }}
                    >
                      {s.label}
                    </button>
                  </li>
                );
              }
              return (
                <li key={`cmd-${idx}`}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center rounded-md border border-terminal-border px-3 py-2 text-left text-base text-terminal-text hover:border-terminal-accent"
                    onClick={() => void onSubmit()}
                  >
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
