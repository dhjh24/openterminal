import { useCallback, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  List,
  LineChart,
  MoreHorizontal,
  Search,
  Briefcase,
  Bell,
  Newspaper,
  Bot,
  SlidersHorizontal,
  CandlestickChart,
  Settings2,
} from "lucide-react";

import { useAgentStore } from "../../agent/agentStore";

const primaryTabs = [
  { label: "Home", path: "/home", icon: Home },
  { label: "Watch", path: "/equity/watchlist", icon: List },
  { label: "Stocks", path: "/equity/stocks", icon: Search },
  { label: "Options", path: "/fno", icon: LineChart },
] as const;

const moreTabs = [
  { label: "News", path: "/equity/news", icon: Newspaper },
  { label: "Alerts", path: "/equity/alerts", icon: Bell },
  { label: "Portfolio", path: "/equity/portfolio", icon: Briefcase },
  { label: "Screener", path: "/equity/screener", icon: SlidersHorizontal },
  { label: "Workstation", path: "/equity/chart-workstation", icon: CandlestickChart },
  { label: "Settings", path: "/equity/settings", icon: Settings2 },
] as const;

type Props = {
  forceMoreOpen?: boolean;
  onMoreOpenChange?: (open: boolean) => void;
};

export function MobileBottomNav({ forceMoreOpen, onMoreOpenChange }: Props = {}) {
  const [internalMoreOpen, setInternalMoreOpen] = useState(false);
  const moreOpen = forceMoreOpen ?? internalMoreOpen;
  const agentToggleOpen = useAgentStore((s) => s.toggleOpen);

  const setMoreOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === "function" ? next(moreOpen) : next;
      setInternalMoreOpen(value);
      onMoreOpenChange?.(value);
    },
    [moreOpen, onMoreOpenChange],
  );

  const closeMore = useCallback(() => setMoreOpen(false), [setMoreOpen]);

  return (
    <>
      {moreOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          role="presentation"
          onClick={closeMore}
          data-testid="mobile-more-sheet-backdrop"
        >
          <div
            className="absolute bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] left-2 right-2 mx-auto max-h-[70dvh] max-w-lg overflow-y-auto rounded-xl border border-terminal-border bg-terminal-panel p-2 shadow-2xl"
            role="menu"
            aria-label="More destinations"
            data-testid="mobile-more-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {moreTabs.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                role="menuitem"
                onClick={closeMore}
                className={({ isActive }) =>
                  `mb-1 flex min-h-[44px] items-center gap-3 rounded-md border px-3 py-2 text-sm last:mb-0 ${
                    isActive
                      ? "border-terminal-accent text-terminal-accent"
                      : "border-terminal-border text-terminal-muted"
                  }`
                }
              >
                <item.icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                agentToggleOpen();
                closeMore();
              }}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-md border border-terminal-border px-3 py-2 text-sm text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
            >
              <Bot size={18} aria-hidden="true" />
              <span>Agent</span>
            </button>
          </div>
        </div>
      ) : null}
      <nav
        className="ot-mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-terminal-border bg-terminal-panel px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 md:hidden"
        aria-label="Primary"
        data-testid="mobile-bottom-nav"
      >
        <div className="grid grid-cols-5 gap-1">
          {primaryTabs.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.label}
              className={({ isActive }) =>
                [
                  "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded border py-1 text-[11px] tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-accent",
                  isActive
                    ? "border-terminal-accent text-terminal-accent"
                    : "border-transparent text-terminal-muted",
                ].join(" ")
              }
            >
              <item.icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            aria-label="More"
            aria-expanded={moreOpen}
            aria-haspopup="menu"
            onClick={() => setMoreOpen((open) => !open)}
            className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded border py-1 text-[11px] tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-accent ${
              moreOpen
                ? "border-terminal-accent text-terminal-accent"
                : "border-transparent text-terminal-muted"
            }`}
          >
            <MoreHorizontal size={18} aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
