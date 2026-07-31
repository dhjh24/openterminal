import { Link } from "react-router-dom";
import { Bell, MoreHorizontal, Search } from "lucide-react";

import { useQuotesStore } from "../../realtime/useQuotesStream";
import { useSettingsStore } from "../../store/settingsStore";
import { useStockStore } from "../../store/stockStore";
import { useNotificationStore } from "../../store/notificationStore";

const BRAND_ICON_SRC = "/favicon.png";

type Props = {
  onSearch: () => void;
  onMore: () => void;
};

function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function MobileHeader({ onSearch, onMore }: Props) {
  const ticker = useStockStore((s) => s.ticker);
  const stock = useStockStore((s) => s.stock);
  const selectedMarket = useSettingsStore((s) => s.selectedMarket);
  const ticksByToken = useQuotesStore((s) => s.ticksByToken);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const togglePanel = useNotificationStore((s) => s.togglePanel);

  const symbol = (ticker || "AAPL").toUpperCase();
  const token = `${String(selectedMarket || "NASDAQ").toUpperCase()}:${symbol}`;
  const tick = ticksByToken[token];
  const price = tick?.ltp ?? stock?.current_price ?? null;
  const changePct = tick?.change_pct ?? stock?.change_pct ?? null;
  const pctPositive = (changePct ?? 0) >= 0;

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-1 border-b border-terminal-border bg-terminal-panel px-2 pt-[env(safe-area-inset-top,0px)] md:hidden"
      data-testid="mobile-header"
      style={{ minHeight: "calc(3rem + env(safe-area-inset-top, 0px))" }}
    >
      <Link
        to="/home"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
        aria-label="OpenTerminal home"
      >
        <img src={BRAND_ICON_SRC} alt="" className="h-7 w-7 object-contain" />
      </Link>

      <div className="min-w-0 flex-1 px-1">
        <div className="truncate font-sans text-sm font-semibold text-terminal-text">{symbol}</div>
        <div className="flex items-baseline gap-1.5 font-mono text-xs tabular-nums">
          <span className="text-terminal-text">{formatPrice(price)}</span>
          {changePct != null ? (
            <span className={pctPositive ? "text-terminal-pos" : "text-terminal-neg"}>
              {formatPct(changePct)}
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onSearch}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-terminal-muted hover:text-terminal-text focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
        aria-label="Search"
        data-testid="mobile-header-search"
      >
        <Search size={20} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => togglePanel()}
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded text-terminal-muted hover:text-terminal-text focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        data-testid="mobile-header-bell"
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-terminal-accent" aria-hidden="true" />
        ) : null}
      </button>

      <button
        type="button"
        onClick={onMore}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-terminal-muted hover:text-terminal-text focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
        aria-label="More"
        aria-haspopup="dialog"
        data-testid="mobile-header-more"
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
    </header>
  );
}
