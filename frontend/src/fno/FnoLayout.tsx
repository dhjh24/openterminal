import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useOutletContext, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";

import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { TerminalShell } from "../components/layout/TerminalShell";
import { TerminalBadge } from "../components/terminal/TerminalBadge";
import { TerminalPanel } from "../components/terminal/TerminalPanel";
import { TerminalSelect } from "../components/terminal/TerminalSelect";
import { useFeedState } from "../hooks/useFeedState";
import { useSettingsStore } from "../store/settingsStore";
import { fetchExpiries } from "./api/fnoApi";
import type { FnoContextValue } from "./types/fno";
import { DEFAULT_FNO_SYMBOLS } from "./types/fno";
import { resolveFnoSymbol, isValidForMarketProfile, getSymbolValidationError } from "./validation/usSymbolValidation";

const LINKS = [
  { to: "/fno", label: "Option Chain", key: "F1" },
  { to: "/fno/greeks", label: "Greeks", key: "F2" },
  { to: "/fno/futures", label: "Futures", key: "F3" },
  { to: "/fno/oi", label: "OI Analysis", key: "F4" },
  { to: "/fno/strategy", label: "Strategy", key: "F5" },
  { to: "/fno/pcr", label: "PCR", key: "F6" },
  { to: "/fno/flow", label: "Flow", key: "F7" },
  { to: "/fno/expiry", label: "Expiry", key: "F8" },
  { to: "/fno/about", label: "About", key: "F9" },
] as const;

const POPULAR_FNO_INDICES = ["SPY", "QQQ", "IWM", "DIA", "SPX", "VIX"] as const;
const FNO_SYMBOL_KEY = "fno:selectedSymbol";

function FnoRightRail({ symbol, expiry, expiries, market }: { symbol: string; expiry: string; expiries: string[]; market: "US" }) {
  const location = useLocation();

  return (
    <aside className="hidden xl:flex h-full w-72 shrink-0 flex-col border-l border-terminal-border bg-terminal-panel">
      <div className="border-b border-terminal-border px-3 py-2">
        <div className="ot-type-panel-title text-terminal-accent">Options & Futures Context</div>
        <div className="ot-type-panel-subtitle text-terminal-muted">Derivatives workspace navigation</div>
      </div>
      <div className="flex-1 space-y-2 overflow-auto p-2">
        <TerminalPanel title="Active Contract" subtitle="Current routing context" actions={<TerminalBadge variant="accent">{market}</TerminalBadge>} bodyClassName="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-terminal-border bg-terminal-bg px-2 py-1">
              <div className="text-terminal-muted">Symbol</div>
              <div className="text-terminal-text">{symbol}</div>
            </div>
            <div className="rounded border border-terminal-border bg-terminal-bg px-2 py-1">
              <div className="text-terminal-muted">Expiry</div>
              <div className="text-terminal-text">{expiry || "No expiry"}</div>
            </div>
          </div>
          <div className="text-[11px] text-terminal-muted">{expiries.length} expiry option{expiries.length === 1 ? "" : "s"} loaded for the current symbol.</div>
        </TerminalPanel>
        <TerminalPanel title="Navigation" subtitle="Match the main app shell" bodyClassName="space-y-1">
          <div className="space-y-1">
            <NavLink to="/" className="block rounded border border-terminal-border px-2 py-1 text-[11px] text-terminal-muted hover:text-terminal-text">Home</NavLink>
            <NavLink to={`/equity/stocks?ticker=${encodeURIComponent(symbol)}`} className="block rounded border border-terminal-border px-2 py-1 text-[11px] text-terminal-muted hover:text-terminal-text">Switch to Equity</NavLink>
          </div>
        </TerminalPanel>
        <TerminalPanel title="Options & Futures Modules" subtitle="Workspace sections" bodyClassName="space-y-1">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === "/fno"} className={({ isActive }) => `flex items-center justify-between rounded border px-2 py-1 text-[11px] ${isActive ? "border-terminal-accent text-terminal-accent" : "border-terminal-border text-terminal-muted hover:text-terminal-text"}`}>
              <span>{link.label}</span>
              <span>{link.key}</span>
            </NavLink>
          ))}
        </TerminalPanel>
        <TerminalPanel title="Route" subtitle="Current page" bodyClassName="text-[11px] text-terminal-muted">{location.pathname}</TerminalPanel>
      </div>
    </aside>
  );
}

export function useFnoContext(): FnoContextValue {
  return useOutletContext<FnoContextValue>();
}

export function FnoLayout() {
  const { label: feedLabel, detail: feedDetail } = useFeedState();

  const location = useLocation();
  const [searchParams] = useSearchParams();
  const setSelectedCountry = useSettingsStore((s) => s.setSelectedCountry);

  // -- Symbol state with US validation --
  const [symbol, setSymbolRaw] = useState<string>(() => resolveFnoSymbol(localStorage.getItem(FNO_SYMBOL_KEY)));
  const [validationError, setValidationError] = useState<string | null>(null);

  const setSymbol = useCallback((value: string) => {
    const cleaned = value.trim().toUpperCase();
    const err = getSymbolValidationError(cleaned);
    if (err) {
      setValidationError(err);
      return; // Don't update symbol
    }
    setValidationError(null);
    setSymbolRaw(cleaned);
    try { localStorage.setItem(FNO_SYMBOL_KEY, cleaned); } catch { /* ignore */ }
    setSelectedCountry("US");
  }, [setSelectedCountry]);

  const [expiry, setExpiry] = useState<string>("");
  const [market] = useState<"US">("US");
  const symbolUniverse = useMemo(() => new Set((DEFAULT_FNO_SYMBOLS as readonly string[]).map((s) => s.toUpperCase())), []);

  // -- Mobile filter sheet state --
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [draftSymbol, setDraftSymbol] = useState(symbol);
  const [draftExpiry, setDraftExpiry] = useState(expiry);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  // -- URL param handling --
  useEffect(() => {
    const incoming = (searchParams.get("symbol") || searchParams.get("ticker") || "").trim().toUpperCase();
    if (!incoming) return;
    if (isValidForMarketProfile(incoming) && (symbolUniverse.has(incoming) || /^[A-Z0-9_-]{2,20}$/.test(incoming))) {
      setSymbolRaw(incoming);
      try { localStorage.setItem(FNO_SYMBOL_KEY, incoming); } catch { /* ignore */ }
    }
  }, [searchParams, symbolUniverse]);

  // -- Expiries --
  const expiryQuery = useQuery({
    queryKey: ["fno-expiries", symbol],
    queryFn: () => fetchExpiries(symbol),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const expiries = useMemo(() => (expiryQuery.data ?? []).filter(Boolean), [expiryQuery.data]);

  useEffect(() => {
    if (!expiries.length) { setExpiry(""); return; }
    if (!expiry || !expiries.includes(expiry)) {
      setExpiry(expiries[0]);
    }
  }, [expiries, expiry]);

  // -- Sheet focus trap --
  useEffect(() => {
    if (!sheetOpen) return;
    lastFocusedRef.current = document.activeElement as HTMLElement;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSheetOpen(false); return; }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handler);
    // Focus first element in sheet
    requestAnimationFrame(() => {
      const first = sheetRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    });
    return () => {
      document.removeEventListener("keydown", handler);
      lastFocusedRef.current?.focus();
    };
  }, [sheetOpen]);

  const openSheet = useCallback(() => {
    setDraftSymbol(symbol);
    setDraftExpiry(expiry);
    setSheetOpen(true);
  }, [symbol, expiry]);

  const applyFilters = useCallback(() => {
    if (draftSymbol !== symbol) setSymbol(draftSymbol);
    if (draftExpiry !== expiry) setExpiry(draftExpiry);
    setSheetOpen(false);
  }, [draftSymbol, draftExpiry, symbol, expiry, setSymbol, setExpiry]);

  // -- Compact date format --
  const compactExpiry = expiry
    ? new Date(expiry + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "No expiry";

  const ctx: FnoContextValue = { symbol, setSymbol, expiry, setExpiry, expiries };

  return (
    <TerminalShell
      contentClassName="pb-[calc(3.75rem+env(safe-area-inset-bottom,0px)+6rem)] md:pb-0"
      showInstallPrompt
      showMobileBottomNav
      workspacePresetStorageKey="ot:shell:fno:preset"
      rightRailStorageKey="ot:shell:fno:right-rail"
      rightRailContent={<FnoRightRail symbol={symbol} expiry={expiry} expiries={expiries} market={market} />}
      statusBarTickerOverride={symbol}
    >
      {/* ── Desktop filter form (md+) ── */}
      {!location.pathname.endsWith("/about") ? (
        <div className="hidden md:block sticky top-0 z-20 border-b border-terminal-border bg-terminal-panel px-3 py-2">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <label className="text-[11px]">
              <span className="mb-1 block uppercase tracking-wide text-terminal-muted">Symbol</span>
              <select
                className="w-full rounded border border-terminal-border bg-terminal-bg px-2 py-1 text-xs outline-none focus:border-terminal-accent"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              >
                {[...new Set([...(DEFAULT_FNO_SYMBOLS as readonly string[]), symbol])].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              {validationError ? <p className="mt-1 text-[10px] text-rose-400">{validationError}</p> : null}
            </label>
            <label className="text-[11px]">
              <span className="mb-1 block uppercase tracking-wide text-terminal-muted">Expiry</span>
              <select className="w-full rounded border border-terminal-border bg-terminal-bg px-2 py-1 text-xs outline-none focus:border-terminal-accent" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                {expiries.map((item) => (<option key={item} value={item}>{item}</option>))}
                {!expiries.length ? <option value="">No expiry</option> : null}
              </select>
            </label>
            <div className="text-[11px]">
              <span className="mb-1 block uppercase tracking-wide text-terminal-muted">Data</span>
              <div
                className="rounded border border-terminal-border bg-terminal-bg px-2 py-1 text-xs"
                data-testid="fno-feed-state"
                title={feedDetail ?? undefined}
              >
                {expiryQuery.isFetching ? "Refreshing..." : feedLabel}
                {!expiryQuery.isFetching && feedDetail ? ` · ${feedDetail}` : ""}
              </div>
            </div>
            <div className="text-[11px]">
              <span className="mb-1 block uppercase tracking-wide text-terminal-muted">Universe</span>
              <div className="rounded border border-terminal-border bg-terminal-bg px-2 py-1 text-xs">US Options & Futures</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-terminal-muted">Popular Underlyings</span>
            {POPULAR_FNO_INDICES.map((idx) => (
              <button key={idx} className={`rounded border px-2 py-1 text-[11px] ${symbol === idx ? "border-terminal-accent text-terminal-accent" : "border-terminal-border text-terminal-muted hover:text-terminal-text"}`} onClick={() => setSymbol(idx)}>{idx}</button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Mobile compact toolbar (<768px) ── */}
      {!location.pathname.endsWith("/about") ? (
        <div className="block md:hidden sticky top-0 z-20 border-b border-terminal-border bg-terminal-panel px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {/* Compact search button */}
              <button
                type="button"
                onClick={() => setSearchOverlayOpen(true)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-terminal-border text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                aria-label="Search symbols"
              >
                <Search size={18} />
              </button>
              {/* Applied filter chips */}
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto text-[11px]">
                <span className="shrink-0 rounded border border-terminal-accent/60 px-1.5 py-1 font-semibold text-terminal-accent">{symbol}</span>
                <span className="shrink-0 rounded border border-terminal-border px-1.5 py-1 text-terminal-muted">{compactExpiry}</span>
                <span className="shrink-0 rounded border border-terminal-border px-1.5 py-1 text-[10px] text-terminal-muted">Live 60s</span>
                <span className="shrink-0 rounded border border-terminal-border px-1.5 py-1 text-[10px] text-terminal-muted">US</span>
              </div>
            </div>
            <button
              type="button"
              onClick={openSheet}
              className="shrink-0 min-h-[44px] rounded border border-terminal-border px-3 py-1 text-[11px] uppercase tracking-wider text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
              aria-label="Open filters"
            >
              Filters
            </button>
          </div>
          {validationError ? <p className="mt-1 text-[10px] text-rose-400">{validationError}</p> : null}
        </div>
      ) : null}

      {/* ── Search overlay ── */}
      {searchOverlayOpen ? (
        <MobileSymbolSearch
          onSelect={(sym) => {
            setSymbol(sym);
            setSearchOverlayOpen(false);
          }}
          onClose={() => setSearchOverlayOpen(false)}
        />
      ) : null}

      {/* ── Mobile filter bottom sheet ── */}
      {sheetOpen ? (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" role="dialog" aria-modal="true" aria-label="Options filters">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSheetOpen(false)} />
          <div ref={sheetRef} className="relative z-10 w-full max-h-[85vh] overflow-auto rounded-t-xl border-t border-terminal-border bg-terminal-panel p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-terminal-text">Options Filters</h2>
              <button type="button" onClick={() => setSheetOpen(false)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-terminal-border text-terminal-muted hover:text-terminal-text" aria-label="Close filters">
                <X size={18} />
              </button>
            </div>

            {/* Symbol input */}
            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-terminal-muted">Symbol</span>
              <input
                className="w-full rounded border border-terminal-border bg-terminal-bg px-3 py-2 text-sm outline-none focus:border-terminal-accent [font-size:16px]"
                value={draftSymbol}
                onChange={(e) => setDraftSymbol(e.target.value.toUpperCase())}
                placeholder="SPY"
                autoComplete="off"
                aria-label="Symbol"
              />
            </label>

            {/* Expiry select */}
            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] uppercase tracking-wider text-terminal-muted">Expiry</span>
              <select
                className="w-full rounded border border-terminal-border bg-terminal-bg px-3 py-2 text-sm outline-none focus:border-terminal-accent [font-size:16px]"
                value={draftExpiry}
                onChange={(e) => setDraftExpiry(e.target.value)}
                aria-label="Expiry"
              >
                <option value="">Select an expiry</option>
                {expiries.map((item) => (<option key={item} value={item}>{item}</option>))}
              </select>
            </label>

            {/* Popular underlyings */}
            <div className="mb-4">
              <p className="mb-1 text-[11px] uppercase tracking-wider text-terminal-muted">Popular</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1" role="list" aria-label="Popular underlyings">
                {POPULAR_FNO_INDICES.map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    role="listitem"
                    className={`shrink-0 min-h-[44px] rounded border px-3 py-1.5 text-[11px] font-semibold ${
                      draftSymbol === idx ? "border-terminal-accent text-terminal-accent bg-terminal-accent/10" : "border-terminal-border text-terminal-muted hover:text-terminal-text"
                    }`}
                    onClick={() => setDraftSymbol(idx)}
                  >
                    {idx}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setDraftSymbol("SPY"); setDraftExpiry(expiries[0] || ""); }}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded border border-terminal-border px-3 text-[11px] uppercase tracking-wider text-terminal-muted hover:border-rose-500 hover:text-rose-400"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="flex min-h-[44px] flex-[2] items-center justify-center rounded border border-terminal-accent bg-terminal-accent px-3 text-[11px] font-semibold uppercase tracking-wider text-black hover:bg-terminal-accent/90"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Page content ── */}
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <ErrorBoundary>
          <Outlet context={ctx} />
        </ErrorBoundary>
      </div>
    </TerminalShell>
  );
}

/** Full-screen mobile symbol search overlay. */
function MobileSymbolSearch({ onSelect, onClose }: { onSelect: (symbol: string) => void; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toUpperCase();
    return (DEFAULT_FNO_SYMBOLS as readonly string[]).filter((s) => s.startsWith(q)).slice(0, 20);
  }, [query]);

  const err = getSymbolValidationError(query);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-terminal-bg md:hidden" role="dialog" aria-modal="true" aria-label="Search symbols">
      <div className="flex items-center gap-2 border-b border-terminal-border px-3 py-3">
        <input
          ref={inputRef}
          className="flex-1 rounded border border-terminal-border bg-terminal-panel px-3 py-2 text-base outline-none focus:border-terminal-accent"
          placeholder="Search symbol (SPY, QQQ, AAPL...)"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          autoComplete="off"
          aria-label="Search symbol"
        />
        <button type="button" onClick={onClose} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-terminal-border text-terminal-muted hover:text-terminal-text" aria-label="Close search">
          Cancel
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {err && query.trim() ? (
          <p className="rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{err}</p>
        ) : null}
        <div className="space-y-1" role="listbox" aria-label="Symbol search results">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => onSelect(s)}
              className="flex min-h-[44px] w-full items-center gap-3 rounded border border-terminal-border px-3 py-2 text-sm text-terminal-text hover:border-terminal-accent hover:bg-terminal-accent/10"
            >
              <span className="font-semibold">{s}</span>
            </button>
          ))}
          {!query.trim() ? (
            <p className="py-4 text-center text-xs text-terminal-muted">Type a symbol to search</p>
          ) : null}
          {query.trim() && !filtered.length && !err ? (
            <p className="py-4 text-center text-xs text-terminal-muted">No results for "{query}"</p>
          ) : null}
        </div>
        {/* Quick picks */}
        <p className="mb-2 mt-4 text-[11px] uppercase tracking-wider text-terminal-muted">Quick picks</p>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_FNO_INDICES.map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(idx)}
              className="min-h-[44px] rounded border border-terminal-border px-3 py-1.5 text-xs font-semibold text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
            >
              {idx}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
