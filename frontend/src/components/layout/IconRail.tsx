import { useContext, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  LineChart,
  CandlestickChart,
  LayoutGrid,
  SlidersHorizontal,
  Sparkles,
  Bot,
  Download,
  Briefcase,
  Eye,
  List,
  Newspaper,
  Bell,
  Settings2,
  type LucideIcon,
} from "lucide-react";

import { AuthContextRef } from "../../contexts/AuthContext";

const BRAND_ICON_SRC = "/favicon.png";

type RailItem = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  to: string;
};

const RAIL_ITEMS: RailItem[] = [
  { id: "home", label: "Home", description: "Mission Control dashboard", icon: Home, to: "/home" },
  { id: "market", label: "Markets", description: "Equity quotes and market browse", icon: LineChart, to: "/equity/stocks" },
  {
    id: "workstation",
    label: "Charts",
    description: "Chart workstation for analysis and drawing",
    icon: CandlestickChart,
    to: "/equity/chart-workstation",
  },
  { id: "launchpad", label: "Launchpad", description: "Multi-panel trading workspace", icon: LayoutGrid, to: "/equity/launchpad" },
  { id: "screener", label: "Screener", description: "Filter and rank equities", icon: SlidersHorizontal, to: "/equity/screener" },
  { id: "alpha-zoo", label: "Alpha Zoo", description: "Factor and alpha research library", icon: Sparkles, to: "/equity/alpha-zoo" },
  {
    id: "research-autopilot",
    label: "Research",
    description: "AI-assisted research autopilot",
    icon: Bot,
    to: "/equity/research-autopilot",
  },
  {
    id: "strategy-export",
    label: "Export",
    description: "Export strategies and signals",
    icon: Download,
    to: "/equity/strategy-export",
  },
  { id: "portfolio", label: "Portfolio", description: "Holdings and performance", icon: Briefcase, to: "/equity/portfolio" },
  {
    id: "shadow-account",
    label: "Shadow",
    description: "Shadow account and bias checks",
    icon: Eye,
    to: "/equity/shadow-account",
  },
  { id: "watchlist", label: "Watchlist", description: "Tracked symbols", icon: List, to: "/equity/watchlist" },
  { id: "news", label: "News", description: "Market headlines and sentiment", icon: Newspaper, to: "/equity/news" },
  { id: "alerts", label: "Alerts", description: "Price and condition alerts", icon: Bell, to: "/equity/alerts" },
  { id: "settings", label: "Settings", description: "Appearance and desk preferences", icon: Settings2, to: "/equity/settings" },
];

export function IconRail() {
  const navigate = useNavigate();
  const authCtx = useContext(AuthContextRef);
  const user = authCtx?.user ?? null;
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const items = useMemo(() => RAIL_ITEMS, []);

  const initials = useMemo(() => {
    if (!user?.email) return "U";
    const local = user.email.split("@")[0] || "";
    const bits = local.split(/[._-]+/).filter(Boolean);
    if (bits.length >= 2) return `${bits[0][0] || ""}${bits[1][0] || ""}`.toUpperCase();
    return (local.slice(0, 2) || "U").toUpperCase();
  }, [user?.email]);

  const focusIndex = (index: number) => {
    if (!items.length) return;
    const bounded = ((index % items.length) + items.length) % items.length;
    linkRefs.current[bounded]?.focus();
  };

  const onRailKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const focusedIndex = linkRefs.current.findIndex((el) => el === document.activeElement);
    if (focusedIndex < 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusIndex(focusedIndex + 1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusIndex(focusedIndex - 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusIndex(items.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const item = items[focusedIndex];
      if (item) {
        navigate(item.to);
      }
    }
  };

  return (
    <aside
      className="hidden h-full w-16 shrink-0 border-r border-terminal-border bg-terminal-panel md:flex md:flex-col"
      aria-label="Primary navigation"
      data-testid="icon-rail"
      onKeyDown={onRailKeyDown}
    >
      <div className="flex items-center justify-center border-b border-terminal-border px-2 py-2">
        <img src={BRAND_ICON_SRC} alt="OpenTerminal" className="h-7 w-7 max-w-full object-contain" />
      </div>
      <nav className="flex-1 space-y-1 overflow-auto p-2" aria-label="Primary destinations">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              ref={(element) => {
                linkRefs.current[index] = element;
              }}
              to={item.to}
              aria-label={`${item.label}. ${item.description}`}
              title={`${item.label} — ${item.description}`}
              data-testid={`icon-rail-${item.id}`}
              className={({ isActive }) =>
                [
                  "flex min-h-11 flex-col items-center justify-center gap-1 rounded-sm border px-1.5 py-2 text-center outline-none",
                  "focus-visible:border-terminal-accent focus-visible:text-terminal-accent focus-visible:ring-2 focus-visible:ring-terminal-accent",
                  isActive
                    ? "border-terminal-accent/80 bg-terminal-accent/15 text-terminal-accent"
                    : "border-transparent text-terminal-muted hover:border-terminal-border hover:text-terminal-text",
                ].join(" ")
              }
            >
              <Icon size={16} aria-hidden="true" />
              <span className="ot-type-label-compact leading-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="space-y-2 border-t border-terminal-border p-2">
        <button
          type="button"
          className="flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-sm border border-terminal-border px-1 py-1 text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-accent"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
          }}
          aria-label="Open command palette"
          title="Command palette (Ctrl+K)"
          data-testid="icon-rail-command-palette"
        >
          <span className="ot-type-label-compact leading-tight">Palette</span>
        </button>
        <button
          type="button"
          className="flex min-h-11 w-full flex-col items-center gap-1 rounded-sm border border-transparent px-1 py-1.5 text-terminal-muted hover:border-terminal-border hover:text-terminal-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-accent"
          onClick={() => navigate("/account")}
          title={user ? `${user.email} (${user.role})` : "Not signed in"}
          aria-label={user ? `Account for ${user.email}` : "Sign in"}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-terminal-border ot-type-label-compact font-medium text-terminal-accent">
            {user ? initials : "?"}
          </span>
          <span className="ot-type-label-compact w-full truncate text-center leading-tight">
            {user ? "Account" : "Sign in"}
          </span>
        </button>
      </div>
    </aside>
  );
}
