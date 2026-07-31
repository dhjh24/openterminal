import { Search, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";

import { NotificationBell } from "../notifications/NotificationBell";
import { useQuotesStore } from "../../realtime/useQuotesStream";
import { useStockStore } from "../../store/stockStore";
import { formatPrice, formatPercent } from "../../lib/format";

const BRAND_ICON_SRC = "/favicon.png";

type Props = {
  onSearchOpen: () => void;
  onMoreOpen: () => void;
};

export function MobileHeader({ onSearchOpen, onMoreOpen }: Props) {
  const ticker = useStockStore((s) => s.ticker);
  const stock = useStockStore((s) => s.stock);
  const ticksByToken = useQuotesStore((s) => s.ticksByToken);

  const liveTick =
    ticksByToken[`NASDAQ:${ticker}`] ||
    ticksByToken[`NYSE:${ticker}`] ||
    ticksByToken[`US:${ticker}`];

  const price =
    typeof liveTick?.ltp === "number"
      ? liveTick.ltp
      : typeof stock?.current_price === "number"
        ? stock.current_price
        : null;

  const changePct =
    typeof liveTick?.change_pct === "number"
      ? liveTick.change_pct
      : typeof stock?.change_pct === "number"
        ? stock.change_pct
        : null;

  const changeClass =
    changePct == null
      ? "text-terminal-muted"
      : changePct >= 0
        ? "text-terminal-pos"
        : "text-terminal-neg";

  return (
    <header
      className="ot-mobile-header sticky top-0 z-30 flex h-[50px] shrink-0 items-center gap-2 border-b border-terminal-border bg-terminal-panel px-2 pt-[env(safe-area-inset-top,0px)] md:hidden"
      data-testid="mobile-header"
    >
      <Link
        to="/home"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm"
        aria-label="OpenTerminal home"
      >
        <img src={BRAND_ICON_SRC} alt="" className="h-7 w-7 object-contain" />
      </Link>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold uppercase tracking-wide text-terminal-text">
          {ticker || "—"}
        </div>
        <div className={`ot-type-data truncate text-[15px] tabular-nums ${changeClass}`}>
          {price == null ? "—" : `$${formatPrice(price)}`}
          {changePct != null ? (
            <span className="ml-1.5 text-[12px]">{formatPercent(changePct)}</span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-terminal-muted hover:text-terminal-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-accent"
        aria-label="Search stocks and commands"
        onClick={onSearchOpen}
        data-testid="mobile-header-search"
      >
        <Search size={20} aria-hidden="true" />
      </button>

      <div className="inline-flex h-11 w-11 items-center justify-center [&_button]:min-h-11 [&_button]:min-w-11">
        <NotificationBell />
      </div>

      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-sm text-terminal-muted hover:text-terminal-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-terminal-accent"
        aria-label="More menu"
        aria-haspopup="dialog"
        onClick={onMoreOpen}
        data-testid="mobile-header-more"
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>
    </header>
  );
}
