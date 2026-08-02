import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createPaperPortfolio,
  fetchPaperPortfolios,
  fetchPaperPositions,
  placePaperOrder,
} from "../../api/client";
import { useDisplayCurrency } from "../../hooks/useDisplayCurrency";
import { formatGreek, formatPrice } from "../../lib/format";
import {
  estimatedDebit,
  optionTypeLabel,
  type SelectedOptionContract,
} from "../types/fno";

type Props = {
  selected: SelectedOptionContract | null;
  underlying: string;
  expiry: string;
  onClear: () => void;
};

export function PaperOptionOrderTicket({ selected, underlying, expiry, onClear }: Props) {
  const { formatDisplayMoney } = useDisplayCurrency();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderId: string; symbol: string } | null>(null);

  const portfoliosQuery = useQuery({
    queryKey: ["paper-portfolios", "options-ticket"],
    queryFn: fetchPaperPortfolios,
    staleTime: 30_000,
  });

  const portfolioId = portfoliosQuery.data?.[0]?.id ?? null;

  useEffect(() => {
    setPreviewOpen(false);
    setError(null);
    setSuccess(null);
    setQuantity(1);
  }, [selected?.contractSymbol, selected?.side, selected?.strike]);

  const debit = useMemo(
    () => (selected ? estimatedDebit(selected.ask, quantity) : 0),
    [quantity, selected],
  );

  const sideLabel = selected ? optionTypeLabel(selected.side) : "";
  const actionLabel = selected ? `Paper Buy ${sideLabel}` : "Paper Buy";

  if (!selected) return null;

  const ensurePortfolio = async (): Promise<string> => {
    if (portfolioId) return portfolioId;
    const created = await createPaperPortfolio({
      name: "Options Paper Desk",
      initial_capital: 100_000,
    });
    await queryClient.invalidateQueries({ queryKey: ["paper-portfolios"] });
    return created.id;
  };

  const confirmBuy = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const id = await ensurePortfolio();
      const order = await placePaperOrder({
        portfolio_id: id,
        symbol: selected.contractSymbol,
        side: "buy",
        order_type: "limit",
        quantity,
        limit_price: selected.ask,
      });
      await queryClient.invalidateQueries({ queryKey: ["paper-portfolios"] });
      await queryClient.invalidateQueries({ queryKey: ["paper", "positions", id] });
      void fetchPaperPositions(id);
      setSuccess({ orderId: String(order.id), symbol: selected.contractSymbol });
      setPreviewOpen(false);
      window.dispatchEvent(
        new CustomEvent("ot:alert-toast", {
          detail: {
            title: "Paper order filled",
            message: `${actionLabel} ${quantity}× ${selected.strike} @ ${formatDisplayMoney(selected.ask)}`,
            variant: "success",
          },
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place paper order");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="sticky bottom-0 z-20 border-t border-terminal-border bg-terminal-panel/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-terminal-panel/90 md:static md:rounded md:border md:backdrop-blur-none"
      aria-label="Paper option order ticket"
      data-testid="paper-option-ticket"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="ot-type-label-compact text-terminal-muted">Selected contract</p>
          <h3 className="text-sm font-semibold text-terminal-text" data-testid="paper-option-selected-label">
            {underlying} {expiry} · {sideLabel} {formatPrice(selected.strike, { decimals: 0 })}
          </h3>
          <p className="mt-1 text-xs text-terminal-muted" aria-live="polite">
            Bid {formatDisplayMoney(selected.bid)} · Ask {formatDisplayMoney(selected.ask)} · Spread{" "}
            {formatDisplayMoney(selected.spread)} · Delta {formatGreek(selected.delta, "delta")} · IV{" "}
            {formatGreek(selected.iv, "iv")}
          </p>
          <p className="mt-1 break-all text-[11px] text-terminal-muted">{selected.contractSymbol}</p>
        </div>
        <button
          type="button"
          className="min-h-11 min-w-11 rounded border border-terminal-border px-3 text-xs text-terminal-muted hover:text-terminal-text"
          onClick={onClear}
          aria-label="Clear selected contract"
        >
          Clear
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_auto] sm:items-end">
        <label className="block text-xs text-terminal-muted" htmlFor="paper-option-qty">
          Quantity (contracts)
          <input
            id="paper-option-qty"
            data-testid="paper-option-qty"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            className="mt-1 min-h-11 w-full rounded border border-terminal-border bg-terminal-bg px-3 text-sm text-terminal-text"
          />
        </label>
        <div className="rounded border border-terminal-border bg-terminal-bg/50 px-3 py-2">
          <div className="ot-type-label-compact text-terminal-muted">Estimated debit</div>
          <div className="text-base font-semibold text-terminal-text" data-testid="paper-option-debit">
            {formatDisplayMoney(debit)}
          </div>
          <div className="text-[11px] text-terminal-muted">Ask × qty × 100 share multiplier</div>
        </div>
        <button
          type="button"
          data-testid="paper-option-preview"
          className="min-h-11 rounded border border-terminal-accent bg-terminal-accent/10 px-4 text-sm font-semibold text-terminal-accent hover:bg-terminal-accent/20"
          onClick={() => {
            setPreviewOpen(true);
            setError(null);
          }}
          aria-label={`Preview ${actionLabel} for strike ${selected.strike}`}
        >
          {actionLabel}
        </button>
      </div>

      {previewOpen ? (
        <div
          className="mt-3 rounded border border-terminal-accent/40 bg-terminal-bg p-3"
          role="dialog"
          aria-modal="true"
          aria-labelledby="paper-option-preview-title"
          data-testid="paper-option-preview-dialog"
        >
          <h4 id="paper-option-preview-title" className="text-sm font-semibold text-terminal-accent">
            Preview {actionLabel}
          </h4>
          <ul className="mt-2 space-y-1 text-xs text-terminal-text">
            <li>Side: Buy {sideLabel}</li>
            <li>Strike: {formatPrice(selected.strike, { decimals: 0 })}</li>
            <li>Limit (ask): {formatDisplayMoney(selected.ask)}</li>
            <li>Quantity: {quantity} contract{quantity === 1 ? "" : "s"}</li>
            <li>Estimated debit: {formatDisplayMoney(debit)}</li>
          </ul>
          <p className="mt-2 text-[11px] text-terminal-muted">
            Paper trading only — this does not send a live broker order.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="paper-option-confirm"
              className="min-h-11 rounded border border-terminal-accent bg-terminal-accent px-4 text-sm font-semibold text-black disabled:opacity-60"
              disabled={submitting}
              onClick={() => {
                void confirmBuy();
              }}
            >
              {submitting ? "Submitting…" : `Confirm ${actionLabel}`}
            </button>
            <button
              type="button"
              className="min-h-11 rounded border border-terminal-border px-4 text-sm text-terminal-muted"
              disabled={submitting}
              onClick={() => setPreviewOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs text-terminal-neg" role="alert">
          {error}
        </p>
      ) : null}

      {success ? (
        <div className="mt-3 rounded border border-terminal-pos/40 bg-terminal-pos/10 p-3 text-xs" data-testid="paper-option-success">
          <p className="font-semibold text-terminal-pos">Position opened</p>
          <p className="mt-1 text-terminal-text">
            Order {success.orderId} filled for {success.symbol}. Track P/L on the paper desk.
          </p>
          <Link
            to="/equity/paper"
            className="mt-2 inline-flex min-h-11 items-center rounded border border-terminal-pos px-3 text-terminal-pos"
          >
            Open paper positions
          </Link>
        </div>
      ) : null}
    </section>
  );
}
