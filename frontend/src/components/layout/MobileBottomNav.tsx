import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Home, List, LineChart, Newspaper, Bell, MoreHorizontal, Search, Briefcase } from "lucide-react";

const primaryTabs = [
  { label: "Home", path: "/home", icon: Home },
  { label: "Watch", path: "/equity/watchlist", icon: List },
  { label: "Stocks", path: "/equity/stocks", icon: Search },
  { label: "Options", path: "/fno", icon: LineChart },
  { label: "News", path: "/equity/news", icon: Newspaper },
];

const moreTabs = [
  { label: "Alerts", path: "/equity/alerts", icon: Bell },
  { label: "Portfolio", path: "/equity/portfolio", icon: Briefcase },
  { label: "Screener", path: "/equity/screener", icon: Search },
];

export function MobileBottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {moreOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          role="presentation"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-16 left-2 right-2 rounded border border-terminal-border bg-terminal-panel p-2"
            role="menu"
            onClick={(e) => e.stopPropagation()}
          >
            {moreTabs.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                role="menuitem"
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `mb-1 flex min-h-11 items-center gap-2 rounded border px-3 py-2 text-sm last:mb-0 ${
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
          </div>
        </div>
      ) : null}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-terminal-border bg-terminal-panel px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 md:hidden">
        <div className="grid grid-cols-6 gap-0.5 ot-type-label-compact">
          {primaryTabs.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.label}
              className={({ isActive }) =>
                `flex min-h-11 flex-col items-center justify-center gap-0.5 rounded border py-1 ${
                  isActive
                    ? "border-terminal-accent text-terminal-accent"
                    : "border-terminal-border text-terminal-muted"
                }`
              }
            >
              <item.icon size={16} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            aria-label="More navigation"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded border py-1 ${
              moreOpen
                ? "border-terminal-accent text-terminal-accent"
                : "border-terminal-border text-terminal-muted"
            }`}
          >
            <MoreHorizontal size={16} aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
