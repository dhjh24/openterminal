import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";

import { searchSymbols, type SearchSymbolItem } from "../../api/client";
import { useRecentSecurities } from "../../hooks/useRecentSecurities";
import { readRecentSearches, recordRecentSearch, type RecentSearch } from "../../home/recentSearches";
import { useSettingsStore } from "../../store/settingsStore";
import { useStockStore } from "../../store/stockStore";
import { parseCommand, executeParsedCommand } from "./commanding";
import { MobileBottomSheet } from "./MobileBottomSheet";

type Props = {
  open: boolean;
  onClose: () => void;
};

const PAGE_SHORTCUTS: Array<{ label: string; path: string; keywords: string }> = [
  { label: "Home", path: "/home", keywords: "home mission" },
  { label: "Markets", path: "/equity/stocks", keywords: "markets stocks quote" },
  { label: "Watchlist", path: "/equity/watchlist", keywords: "watch list" },
  { label: "Chart Workstation", path: "/equity/chart-workstation", keywords: "chart workstation trade" },
  { label: "Options & Futures", path: "/fno", keywords: "options chain futures" },
  { label: "Options Heatmap", path: "/fno/heatmap", keywords: "heatmap oi" },
  { label: "Portfolio", path: "/equity/portfolio", keywords: "portfolio holdings" },
  { label: "News", path: "/equity/news", keywords: "news" },
  { label: "Alerts", path: "/equity/alerts", keywords: "alerts" },
  { label: "Screener", path: "/equity/screener", keywords: "screener filter research" },
  { label: "Backtesting", path: "/backtesting", keywords: "backtest research" },
  { label: "Settings", path: "/equity/settings", keywords: "settings appearance" },
  { label: "Account", path: "/account", keywords: "account profile" },
];

export function MobileSearchSheet({ open, onClose }: Props) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSymbolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => readRecentSearches());
  const selectedMarket = useSettingsStore((s) => s.selectedMarket);
  const setTicker = useStockStore((s) => s.setTicker);
  const load = useStockStore((s) => s.load);
  const { recentSecurities, addRecent } = useRecentSecurities();
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setRecentSearches(readRecentSearches());
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

  const rememberQuery = useCallback((value: string) => {
    setRecentSearches(recordRecentSearch(value));
  }, []);

  const selectSymbol = useCallback(
    async (symbol: string, name?: string) => {
      const next = symbol.trim().toUpperCase();
      if (!next) return;
      rememberQuery(next);
      setTicker(next);
      addRecent(next, name || next, "equity", "US");
      void load();
      onClose();
      navigate(`/equity/stocks/${encodeURIComponent(next)}`);
    },
    [addRecent, load, navigate, onClose, rememberQuery, setTicker],
  );

  const selectPage = useCallback(
    (path: string, label: string) => {
      rememberQuery(label);
      onClose();
      navigate(path);
    },
    [navigate, onClose, rememberQuery],
  );

  const runCommand = useCallback(
    async (command: string) => {
      rememberQuery(command);
      const parsed = parseCommand(command);
      await executeParsedCommand(parsed, navigate);
      onClose();
    },
    [navigate, onClose, rememberQuery],
  );

  const onSubmit = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    if (results[0]?.ticker) {
      await selectSymbol(results[0].ticker, results[0].name);
      return;
    }
    await runCommand(q);
  }, [query, results, runCommand, selectSymbol]);

  const pages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PAGE_SHORTCUTS.filter(
      (p) => p.label.toLowerCase().includes(q) || p.keywords.includes(q),
    );
  }, [query]);

  const commands = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return [{ label: `Run “${q}”`, command: q }];
  }, [query]);

  const emptyQuery = !query.trim();

  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      title="Search"
      maxHeightClassName="max-h-[70dvh]"
      aboveBottomNav
      testId="mobile-search-sheet"
    >
      <div className="flex min-h-0 flex-1 flex-col">
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
            placeholder="Search symbols, pages, and commands"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void onSubmit();
              }
            }}
            aria-label="Search symbols, pages, and commands"
            data-testid="mobile-search-input"
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
          {loading ? <div className="px-3 py-4 text-sm text-terminal-muted">Searching…</div> : null}

          {emptyQuery ? (
            <>
              <ResultGroup title="Recent searches" testId="search-group-recent">
                {recentSearches.length === 0 && recentSecurities.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-terminal-muted">No recent searches yet.</p>
                ) : null}
                {recentSearches.map((item) => (
                  <li key={`rs-${item.query}-${item.at}`}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center rounded-md border border-terminal-border px-3 text-left text-base text-terminal-text hover:border-terminal-accent"
                      onClick={() => setQuery(item.query)}
                    >
                      {item.query}
                    </button>
                  </li>
                ))}
                {recentSecurities.slice(0, 6).map((item) => (
                  <li key={`sec-${item.symbol}`}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between rounded-md border border-terminal-border px-3 text-left hover:border-terminal-accent"
                      onClick={() => void selectSymbol(item.symbol, item.name)}
                    >
                      <span className="text-base font-semibold text-terminal-text">{item.symbol}</span>
                      <span className="truncate pl-3 text-sm text-terminal-muted">{item.name || "Recent"}</span>
                    </button>
                  </li>
                ))}
              </ResultGroup>
            </>
          ) : (
            <>
              <ResultGroup title="Symbols" testId="search-group-symbols">
                {results.length === 0 && !loading ? (
                  <p className="px-3 py-2 text-sm text-terminal-muted">No symbols match.</p>
                ) : null}
                {results.map((item) => (
                  <li key={`sym-${item.ticker}`}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between rounded-md border border-terminal-border px-3 text-left hover:border-terminal-accent"
                      onClick={() => void selectSymbol(item.ticker, item.name)}
                    >
                      <span className="text-base font-semibold text-terminal-text">{item.ticker}</span>
                      <span className="truncate pl-3 text-sm text-terminal-muted">{item.name}</span>
                    </button>
                  </li>
                ))}
              </ResultGroup>

              <ResultGroup title="Pages and tools" testId="search-group-pages">
                {pages.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-terminal-muted">No pages match.</p>
                ) : null}
                {pages.map((page) => (
                  <li key={page.path}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center rounded-md border border-terminal-border px-3 text-left text-base text-terminal-text hover:border-terminal-accent"
                      onClick={() => selectPage(page.path, page.label)}
                    >
                      {page.label}
                    </button>
                  </li>
                ))}
              </ResultGroup>

              <ResultGroup title="Commands" testId="search-group-commands">
                {commands.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-terminal-muted">Type at least two characters to run a command.</p>
                ) : null}
                {commands.map((command) => (
                  <li key={command.command}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center rounded-md border border-terminal-border px-3 text-left text-base text-terminal-text hover:border-terminal-accent"
                      onClick={() => void runCommand(command.command)}
                    >
                      {command.label}
                    </button>
                  </li>
                ))}
              </ResultGroup>
            </>
          )}
        </div>
      </div>
    </MobileBottomSheet>
  );
}

function ResultGroup({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-3" aria-label={title} data-testid={testId}>
      <h3 className="px-2 pb-1 text-[11px] uppercase tracking-[0.14em] text-terminal-muted">{title}</h3>
      <ul className="space-y-1">{children}</ul>
    </section>
  );
}
