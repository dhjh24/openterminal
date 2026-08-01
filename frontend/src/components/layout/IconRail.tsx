import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  LineChart,
  CandlestickChart,
  Briefcase,
  FlaskConical,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

import { AuthContextRef } from "../../contexts/AuthContext";
import { useAgentStore } from "../../agent/agentStore";
import {
  DESKTOP_HUBS,
  isDesktopHubActive,
  isDesktopMoreDestinationActive,
  MORE_SECTIONS,
  type DesktopHubId,
} from "../../home/mobileNav";

const BRAND_ICON_SRC = "/favicon.png";

const HUB_ICONS: Record<DesktopHubId, LucideIcon> = {
  home: Home,
  markets: LineChart,
  trade: CandlestickChart,
  research: FlaskConical,
  portfolio: Briefcase,
};

export function IconRail() {
  const navigate = useNavigate();
  const location = useLocation();
  const authCtx = useContext(AuthContextRef);
  const user = authCtx?.user ?? null;
  const agentToggleOpen = useAgentStore((s) => s.toggleOpen);
  const linkRefs = useRef<Array<HTMLElement | null>>([]);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const morePanelRef = useRef<HTMLDivElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const titleId = useId();
  const hubs = useMemo(() => DESKTOP_HUBS, []);
  const moreActive = isDesktopMoreDestinationActive(location.pathname);

  const initials = useMemo(() => {
    if (!user?.email) return "U";
    const local = user.email.split("@")[0] || "";
    const bits = local.split(/[._-]+/).filter(Boolean);
    if (bits.length >= 2) return `${bits[0][0] || ""}${bits[1][0] || ""}`.toUpperCase();
    return (local.slice(0, 2) || "U").toUpperCase();
  }, [user?.email]);

  const focusIndex = (index: number) => {
    const total = hubs.length + 1; // hubs + More
    if (!total) return;
    const bounded = ((index % total) + total) % total;
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
      focusIndex(hubs.length);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (focusedIndex < hubs.length) {
        event.preventDefault();
        const hub = hubs[focusedIndex];
        if (hub) navigate(hub.path);
      }
    }
  };

  const closeMore = useCallback(() => {
    setMoreOpen(false);
    moreButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const panel = morePanelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMore();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [moreOpen, closeMore]);

  return (
    <aside
      className="relative hidden h-full w-16 shrink-0 border-r border-terminal-border bg-terminal-panel md:flex md:flex-col"
      aria-label="Primary navigation"
      data-testid="icon-rail"
      onKeyDown={onRailKeyDown}
    >
      <div className="flex items-center justify-center border-b border-terminal-border px-2 py-2">
        <img src={BRAND_ICON_SRC} alt="OpenTerminal" className="h-7 w-7 max-w-full object-contain" />
      </div>
      <nav className="flex-1 space-y-1 overflow-auto p-2" aria-label="Primary destinations">
        {hubs.map((hub, index) => {
          const Icon = HUB_ICONS[hub.id];
          const active = isDesktopHubActive(hub.id, location.pathname);
          return (
            <NavLink
              key={hub.id}
              ref={(element) => {
                linkRefs.current[index] = element;
              }}
              to={hub.path}
              aria-label={`${hub.label}. ${hub.description}`}
              title={`${hub.label} — ${hub.description}`}
              aria-current={active ? "page" : undefined}
              data-testid={`icon-rail-${hub.id}`}
              data-active={active ? "true" : "false"}
              className={[
                "flex min-h-11 flex-col items-center justify-center gap-1 rounded-sm border px-1.5 py-2 text-center outline-none",
                "focus-visible:border-terminal-accent focus-visible:text-terminal-accent focus-visible:ring-2 focus-visible:ring-terminal-accent",
                active
                  ? "border-terminal-accent/80 bg-terminal-accent/15 text-terminal-accent"
                  : "border-transparent text-terminal-muted hover:border-terminal-border hover:text-terminal-text",
              ].join(" ")}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="ot-type-label-compact leading-tight">{hub.label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          ref={(element) => {
            moreButtonRef.current = element;
            linkRefs.current[hubs.length] = element;
          }}
          aria-label="More destinations"
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          title="More destinations"
          data-testid="icon-rail-more"
          data-active={moreOpen || moreActive ? "true" : "false"}
          onClick={() => setMoreOpen((open) => !open)}
          className={[
            "flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-sm border px-1.5 py-2 text-center outline-none",
            "focus-visible:border-terminal-accent focus-visible:text-terminal-accent focus-visible:ring-2 focus-visible:ring-terminal-accent",
            moreOpen || moreActive
              ? "border-terminal-accent/80 bg-terminal-accent/15 text-terminal-accent"
              : "border-transparent text-terminal-muted hover:border-terminal-border hover:text-terminal-text",
          ].join(" ")}
        >
          <MoreHorizontal size={16} aria-hidden="true" />
          <span className="ot-type-label-compact leading-tight">More</span>
        </button>
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

      {moreOpen ? (
        <div className="absolute left-full top-0 z-50 flex h-full pl-1" data-testid="icon-rail-more-panel-wrap">
          <button type="button" className="fixed inset-0 z-40 cursor-default bg-black/20" aria-label="Close more destinations" onClick={closeMore} />
          <div
            ref={morePanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            data-testid="icon-rail-more-panel"
            className="relative z-50 flex h-full w-72 flex-col overflow-hidden border border-terminal-border bg-terminal-panel shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-terminal-border px-3 py-2">
              <h2 id={titleId} className="text-sm font-semibold text-terminal-text">
                More destinations
              </h2>
              <button
                type="button"
                onClick={closeMore}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-terminal-border text-terminal-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-accent"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
              {MORE_SECTIONS.map((section) => (
                <section key={section.id} aria-labelledby={`rail-more-${section.id}`}>
                  <h3 id={`rail-more-${section.id}`} className="mb-2 text-[11px] uppercase tracking-[0.14em] text-terminal-muted">
                    {section.title}
                  </h3>
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      if (item.kind === "agent") {
                        return (
                          <li key="agent">
                            <button
                              type="button"
                              onClick={() => {
                                agentToggleOpen();
                                closeMore();
                              }}
                              className="flex min-h-11 w-full items-center rounded-md border border-terminal-border px-3 text-sm text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                            >
                              {item.label}
                            </button>
                          </li>
                        );
                      }
                      return (
                        <li key={item.path + item.label}>
                          <NavLink
                            to={item.path}
                            onClick={closeMore}
                            className={({ isActive }) =>
                              `flex min-h-11 items-center rounded-md border px-3 text-sm ${
                                isActive
                                  ? "border-terminal-accent text-terminal-accent"
                                  : "border-terminal-border text-terminal-muted hover:border-terminal-accent hover:text-terminal-accent"
                              }`
                            }
                          >
                            {item.label}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
