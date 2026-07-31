import { NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  Bot,
  Briefcase,
  CandlestickChart,
  Home,
  LineChart,
  List,
  MoreHorizontal,
  Newspaper,
  Search,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";

import { useAgentStore } from "../../agent/agentStore";
import { MobileBottomSheet } from "./MobileBottomSheet";

const primaryTabs = [
  { label: "Home", path: "/home", icon: Home },
  { label: "Watch", path: "/equity/watchlist", icon: List },
  { label: "Stocks", path: "/equity/stocks", icon: Search },
  { label: "Options", path: "/fno", icon: LineChart },
] as const;

const moreItems = [
  { label: "News", path: "/equity/news", icon: Newspaper },
  { label: "Alerts", path: "/equity/alerts", icon: Bell },
  { label: "Portfolio", path: "/equity/portfolio", icon: Briefcase },
  { label: "Screener", path: "/equity/screener", icon: SlidersHorizontal },
  { label: "Workstation", path: "/equity/chart-workstation", icon: CandlestickChart },
  { label: "Settings", path: "/equity/settings", icon: Settings2 },
] as const;

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const toggleAgent = useAgentStore((s) => s.toggleOpen);

  return (
    <>
      <MobileBottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More"
        maxHeightClassName="max-h-[70dvh]"
        aboveBottomNav
        testId="mobile-more-sheet"
      >
        <div className="flex flex-col gap-1 p-2" role="menu">
          {moreItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              role="menuitem"
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded border px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent ${
                  isActive
                    ? "border-terminal-accent text-terminal-accent"
                    : "border-terminal-border text-terminal-text"
                }`
              }
            >
              <item.icon size={20} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMoreOpen(false);
              toggleAgent();
            }}
            className="flex min-h-11 items-center gap-3 rounded border border-terminal-border px-3 py-2 text-left text-base text-terminal-text focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
          >
            <Bot size={20} aria-hidden="true" />
            <span>Agent</span>
          </button>
        </div>
      </MobileBottomSheet>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-terminal-border bg-terminal-panel px-1 pb-[env(safe-area-inset-bottom,0px)] pt-1 md:hidden"
        aria-label="Primary"
        data-testid="mobile-bottom-nav"
        style={{ ["--ot-mobile-nav-height" as string]: "3.5rem" }}
      >
        <div className="grid grid-cols-5 gap-0.5">
          {primaryTabs.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.label}
              className={({ isActive }) =>
                `flex min-h-11 flex-col items-center justify-center gap-0.5 rounded py-1 text-[11px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent ${
                  isActive ? "text-terminal-accent" : "text-terminal-muted"
                }`
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
            aria-haspopup="dialog"
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded py-1 text-[11px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent ${
              moreOpen ? "text-terminal-accent" : "text-terminal-muted"
            }`}
            data-testid="mobile-nav-more"
          >
            <MoreHorizontal size={18} aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

/** Header More opens the same destinations without duplicating nav chrome */
export function MobileMoreMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toggleAgent = useAgentStore((s) => s.toggleOpen);
  const navigate = useNavigate();

  return (
    <MobileBottomSheet
      open={open}
      onClose={onClose}
      title="More"
      maxHeightClassName="max-h-[70dvh]"
      aboveBottomNav
      testId="mobile-header-more-sheet"
    >
      <div className="flex flex-col gap-1 p-2" role="menu">
        {moreItems.map((item) => (
          <button
            key={item.path}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              navigate(item.path);
            }}
            className="flex min-h-11 items-center gap-3 rounded border border-terminal-border px-3 py-2 text-left text-base text-terminal-text focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
          >
            <item.icon size={20} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            toggleAgent();
          }}
          className="flex min-h-11 items-center gap-3 rounded border border-terminal-border px-3 py-2 text-left text-base text-terminal-text focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
        >
          <Bot size={20} aria-hidden="true" />
          <span>Agent</span>
        </button>
      </div>
    </MobileBottomSheet>
  );
}
