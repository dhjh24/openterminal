import { useCallback, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  LineChart,
  MoreHorizontal,
  Briefcase,
  CandlestickChart,
  type LucideIcon,
} from "lucide-react";

import { useAgentStore } from "../../agent/agentStore";
import {
  isMobileHubActive,
  isMoreDestinationActive,
  MOBILE_HUBS,
  MORE_SECTIONS,
  type MobileHubId,
} from "../../home/mobileNav";
import { MobileBottomSheet } from "./MobileBottomSheet";

const HUB_ICONS: Record<MobileHubId, LucideIcon> = {
  home: Home,
  markets: LineChart,
  trade: CandlestickChart,
  portfolio: Briefcase,
};

type Props = {
  forceMoreOpen?: boolean;
  onMoreOpenChange?: (open: boolean) => void;
};

export function MobileBottomNav({ forceMoreOpen, onMoreOpenChange }: Props = {}) {
  const location = useLocation();
  const [internalMoreOpen, setInternalMoreOpen] = useState(false);
  const moreOpen = forceMoreOpen ?? internalMoreOpen;
  const agentToggleOpen = useAgentStore((s) => s.toggleOpen);
  const moreHubActive = isMoreDestinationActive(location.pathname);

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
      <MobileBottomSheet
        open={moreOpen}
        onClose={closeMore}
        title="More"
        maxHeightClassName="max-h-[75dvh]"
        aboveBottomNav
        testId="mobile-more-sheet"
      >
        <div className="space-y-4 p-3" data-testid="mobile-more-sections">
          {MORE_SECTIONS.map((section) => (
            <section key={section.id} aria-labelledby={`more-section-${section.id}`}>
              <h3
                id={`more-section-${section.id}`}
                className="mb-2 text-[11px] uppercase tracking-[0.14em] text-terminal-muted"
              >
                {section.title}
              </h3>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  if (item.kind === "agent") {
                    return (
                      <li key="agent">
                        <button
                          type="button"
                          role="menuitem"
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
                        role="menuitem"
                        onClick={closeMore}
                        className={({ isActive }) =>
                          `flex min-h-11 items-center rounded-md border px-3 text-sm ${
                            isActive
                              ? "border-terminal-accent text-terminal-accent"
                              : "border-terminal-border text-terminal-muted"
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
      </MobileBottomSheet>

      <nav
        className="ot-mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-terminal-border bg-terminal-panel px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 md:hidden"
        aria-label="Primary"
        data-testid="mobile-bottom-nav"
      >
        <div className="grid grid-cols-5 gap-1">
          {MOBILE_HUBS.map((hub) => {
            const Icon = HUB_ICONS[hub.id];
            const active = isMobileHubActive(hub.id, location.pathname);
            return (
              <NavLink
                key={hub.id}
                to={hub.path}
                aria-label={hub.label}
                aria-current={active ? "page" : undefined}
                data-testid={`mobile-hub-${hub.id}`}
                data-active={active ? "true" : "false"}
                className={[
                  "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded border py-1 text-[11px] tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-accent",
                  active
                    ? "border-terminal-accent text-terminal-accent"
                    : "border-transparent text-terminal-muted",
                ].join(" ")}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{hub.label}</span>
              </NavLink>
            );
          })}
          <button
            type="button"
            aria-label="More"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            data-testid="mobile-hub-more"
            data-active={moreOpen || moreHubActive ? "true" : "false"}
            onClick={() => setMoreOpen((open) => !open)}
            className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded border py-1 text-[11px] tracking-wide focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-accent ${
              moreOpen || moreHubActive
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
