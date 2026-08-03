import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";

import { NumericValue } from "../../components/terminal/NumericValue";
import { useDisplayCurrency } from "../../hooks/useDisplayCurrency";
import { formatGreek, formatPrice, formatSignedNumber, isMissingNumber } from "../../lib/format";
import {
  optionTypeLabel,
  selectContractFromStrike,
  type OptionSide,
  type SelectedOptionContract,
  type StrikeData,
} from "../types/fno";
import { PaperOptionOrderTicket } from "./PaperOptionOrderTicket";

type SortKey = "strike" | "ce_oi" | "ce_oi_change" | "pe_oi" | "pe_oi_change";
type MobileSide = "calls" | "puts";

type Props = {
  rows: StrikeData[];
  atmStrike: number;
  underlying: string;
  expiry: string;
  /** ISO timestamp from chain payload — used to mark delayed rows when stale. */
  dataTimestamp?: string;
  isDelayed?: boolean;
};

const STALE_AFTER_MS = 60_000;
const TOUCH = "min-h-11 min-w-11";

function val(row: StrikeData, key: SortKey): number {
  if (key === "strike") return Number(row.strike_price || 0);
  if (key === "ce_oi") return Number(row.ce?.oi || 0);
  if (key === "ce_oi_change") return Number(row.ce?.oi_change || 0);
  if (key === "pe_oi") return Number(row.pe?.oi || 0);
  return Number(row.pe?.oi_change || 0);
}

function greekTone(kind: "delta" | "theta", value: number): string {
  if (kind === "delta") {
    const d = Math.abs(value);
    if (d > 0.8) return "text-emerald-400 font-semibold";
    if (d > 0.5) return "text-emerald-500";
    if (d > 0.2) return "text-emerald-600/90";
    return "text-terminal-muted";
  }
  const t = Math.abs(value);
  if (t > 1.0) return "text-rose-400 font-semibold";
  if (t > 0.5) return "text-rose-500";
  return "text-terminal-muted";
}

function OiChangeCell({ value }: { value: number }) {
  const tone = value > 0 ? "up" : value < 0 ? "down" : "neutral";
  const toneClass = tone === "up" ? "text-terminal-pos" : tone === "down" ? "text-terminal-neg" : "text-terminal-muted";
  const signLabel = tone === "up" ? "up" : tone === "down" ? "down" : "unchanged";
  return (
    <span className={`ot-type-data tabular-nums ${toneClass}`} aria-label={`OI change ${signLabel} ${formatSignedNumber(value, { decimals: 0 })}`}>
      {formatSignedNumber(value, { decimals: 0 })}
      <span className="sr-only"> ({signLabel})</span>
    </span>
  );
}

function GreekCell({ value, kind }: { value: number; kind: "delta" | "gamma" | "theta" | "vega" | "iv" }) {
  const colorClass = kind === "delta" || kind === "theta" ? greekTone(kind, value) : "text-terminal-text";
  return (
    <span className={`ot-type-data tabular-nums ${colorClass}`}>
      {formatGreek(value, kind)}
    </span>
  );
}

function StaleMarker({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      className="ml-1 inline-block rounded border border-terminal-border/80 bg-terminal-bg px-1 ot-type-label-compact uppercase text-terminal-muted"
      title="Delayed"
      aria-label="Delayed"
    >
      Delayed
    </span>
  );
}

function ValueWithFreshness({ showStale, children }: { showStale: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-end gap-0.5">
      {children}
      <StaleMarker show={showStale} />
    </span>
  );
}

const NUM_CELL = "px-2 py-2 text-right";
const CALL_SIDE = "bg-terminal-bg/20";
const PUT_SIDE = "bg-terminal-panel/30";
const STRIKE_CELL = "px-2 py-2 text-center font-semibold border-x border-terminal-border/50 bg-terminal-panel/40";

function isSelected(
  selected: SelectedOptionContract | null,
  side: OptionSide,
  strike: number,
): boolean {
  return Boolean(selected && selected.side === side && Math.abs(selected.strike - strike) < 1e-9);
}

export function OptionChainTable({
  rows,
  atmStrike,
  underlying,
  expiry,
  dataTimestamp,
  isDelayed,
}: Props) {
  const { formatDisplayMoney } = useDisplayCurrency();
  const [sortKey, setSortKey] = useState<SortKey>("strike");
  const [asc, setAsc] = useState(true);
  const [showGreeks, setShowGreeks] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  const [mobileSide, setMobileSide] = useState<MobileSide>("calls");
  const [selected, setSelected] = useState<SelectedOptionContract | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const showStale = useMemo(() => {
    if (isDelayed) return true;
    if (!dataTimestamp) return false;
    const parsed = Date.parse(dataTimestamp);
    if (Number.isNaN(parsed)) return false;
    return Date.now() - parsed > STALE_AFTER_MS;
  }, [dataTimestamp, isDelayed]);

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => (asc ? val(a, sortKey) - val(b, sortKey) : val(b, sortKey) - val(a, sortKey)));
    return out;
  }, [rows, sortKey, asc]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setAsc((v) => !v);
      return;
    }
    setSortKey(key);
    setAsc(true);
  };

  const selectLeg = (row: StrikeData, side: OptionSide) => {
    const next = selectContractFromStrike(row, side, underlying, expiry);
    if (!next) return;
    setSelected(next);
    setDetailOpen(true);
  };

  const onCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, row: StrikeData, side: OptionSide) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectLeg(row, side);
    }
  };

  const headerLabel = "ot-type-table-header uppercase tracking-wide text-terminal-muted";
  const panelLabel = "ot-type-label-compact font-bold uppercase tracking-wider text-terminal-muted";
  const primaryCols = showSecondary ? 7 : 5;
  const greeksCols = showGreeks ? 2 : 0;
  const sideColSpan = primaryCols + greeksCols;

  const renderLegButton = (row: StrikeData, side: OptionSide) => {
    const leg = side === "CE" ? row.ce : row.pe;
    const strike = Number(row.strike_price);
    const selectedHere = isSelected(selected, side, strike);
    const bid = Number(leg?.bid || 0);
    const ask = Number(leg?.ask || leg?.ltp || 0);
    const delta = Number(leg?.greeks?.delta || 0);
    const label = `${optionTypeLabel(side)} strike ${formatPrice(strike, { decimals: 0 })}, bid ${bid}, ask ${ask}, spread ${Math.max(0, ask - bid)}, delta ${delta}${selectedHere ? ", selected" : ""}`;

    return (
      <button
        type="button"
        className={`${TOUCH} w-full rounded border px-2 py-1 text-right ot-type-data focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terminal-accent ${
          selectedHere
            ? "border-terminal-accent bg-terminal-accent/15 font-semibold text-terminal-accent ring-2 ring-terminal-accent/40"
            : "border-transparent text-terminal-accent hover:border-terminal-border hover:bg-terminal-bg"
        }`}
        aria-pressed={selectedHere}
        aria-label={label}
        data-testid={`option-select-${side}-${strike}`}
        onClick={() => selectLeg(row, side)}
        onKeyDown={(event) => onCellKeyDown(event, row, side)}
      >
        <span className="inline-flex w-full items-center justify-end gap-1">
          {selectedHere ? <span aria-hidden="true">✓</span> : null}
          <span>{isMissingNumber(leg?.ltp) ? "—" : formatDisplayMoney(Number(leg?.ltp))}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3" data-testid="option-chain-table">
      <div className="rounded border border-terminal-border bg-terminal-panel p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border px-3 py-2">
          <div className={panelLabel}>Option Chain</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded border border-terminal-border p-0.5 md:hidden" role="tablist" aria-label="Calls or puts">
              {(["calls", "puts"] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  role="tab"
                  aria-selected={mobileSide === side}
                  className={`${TOUCH} rounded px-3 text-xs uppercase ${
                    mobileSide === side ? "bg-terminal-accent/20 text-terminal-accent" : "text-terminal-muted"
                  }`}
                  onClick={() => setMobileSide(side)}
                >
                  {side}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowSecondary((v) => !v)}
              className={`${TOUCH} rounded border px-3 text-xs uppercase ${
                showSecondary ? "border-terminal-accent text-terminal-accent" : "border-terminal-border text-terminal-muted"
              }`}
            >
              {showSecondary ? "Hide OI/Vol" : "Show OI/Vol"}
            </button>
            <button
              type="button"
              onClick={() => setShowGreeks((v) => !v)}
              className={`${TOUCH} hidden rounded border px-3 text-xs uppercase md:inline-flex md:items-center ${
                showGreeks ? "border-terminal-accent text-terminal-accent" : "border-terminal-border text-terminal-muted"
              }`}
            >
              {showGreeks ? "Hide Greeks" : "Show Greeks"}
            </button>
          </div>
        </div>

        {/* Desktop / tablet table */}
        <div className="hidden max-h-[520px] overflow-auto md:block" data-testid="option-chain-desktop-table">
          <table className="min-w-full ot-type-table-cell">
            <thead className="sticky top-0 z-10 bg-terminal-panel">
              <tr className={`border-b border-terminal-border ${headerLabel}`}>
                <th scope="colgroup" className={`${NUM_CELL} ${CALL_SIDE}`} colSpan={sideColSpan}>
                  Calls
                </th>
                <th scope="col" className="px-2 py-2 text-center">
                  Strike
                </th>
                <th scope="colgroup" className={`text-right ${PUT_SIDE}`} colSpan={sideColSpan}>
                  Puts
                </th>
              </tr>
              <tr className={`border-b border-terminal-border ${headerLabel}`}>
                {showGreeks ? (
                  <>
                    <th className={`${NUM_CELL} ${CALL_SIDE}`}>Theta</th>
                    <th className={`${NUM_CELL} ${CALL_SIDE}`}>Delta</th>
                  </>
                ) : (
                  <th className={`${NUM_CELL} ${CALL_SIDE}`}>Delta</th>
                )}
                {showSecondary ? (
                  <>
                    <th className={`${NUM_CELL} ${CALL_SIDE}`}>OI</th>
                    <th className={`${NUM_CELL} cursor-pointer ${CALL_SIDE}`} onClick={() => onSort("ce_oi_change")}>
                      ΔOI
                    </th>
                    <th className={`${NUM_CELL} ${CALL_SIDE}`}>Vol</th>
                  </>
                ) : null}
                <th className={`${NUM_CELL} ${CALL_SIDE}`}>IV</th>
                <th className={`${NUM_CELL} ${CALL_SIDE}`}>Bid</th>
                <th className={`${NUM_CELL} ${CALL_SIDE}`}>Ask</th>
                <th className={`${NUM_CELL} ${CALL_SIDE}`}>Sprd</th>
                <th className={`${NUM_CELL} ${CALL_SIDE}`}>Last</th>
                <th className={STRIKE_CELL}>Strike</th>
                <th className={`${NUM_CELL} ${PUT_SIDE}`}>Last</th>
                <th className={`${NUM_CELL} ${PUT_SIDE}`}>Bid</th>
                <th className={`${NUM_CELL} ${PUT_SIDE}`}>Ask</th>
                <th className={`${NUM_CELL} ${PUT_SIDE}`}>Sprd</th>
                <th className={`${NUM_CELL} ${PUT_SIDE}`}>IV</th>
                {showSecondary ? (
                  <>
                    <th className={`${NUM_CELL} ${PUT_SIDE}`}>Vol</th>
                    <th className={`${NUM_CELL} cursor-pointer ${PUT_SIDE}`} onClick={() => onSort("pe_oi_change")}>
                      ΔOI
                    </th>
                    <th className={`${NUM_CELL} ${PUT_SIDE}`}>OI</th>
                  </>
                ) : null}
                {showGreeks ? (
                  <>
                    <th className={`${NUM_CELL} ${PUT_SIDE}`}>Delta</th>
                    <th className={`${NUM_CELL} ${PUT_SIDE}`}>Theta</th>
                  </>
                ) : (
                  <th className={`${NUM_CELL} ${PUT_SIDE}`}>Delta</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const strike = Number(row.strike_price);
                const isAtm = Math.abs(strike - atmStrike) < 1e-9;
                const ceSelected = isSelected(selected, "CE", strike);
                const peSelected = isSelected(selected, "PE", strike);
                const rowClass = ceSelected || peSelected
                  ? "bg-terminal-accent/10 outline outline-1 outline-terminal-accent/50"
                  : isAtm
                    ? "bg-terminal-accent/5 ring-1 ring-inset ring-terminal-accent/25"
                    : "hover:bg-terminal-bg/60";
                const ceBid = Number(row.ce?.bid || 0);
                const ceAsk = Number(row.ce?.ask || row.ce?.ltp || 0);
                const peBid = Number(row.pe?.bid || 0);
                const peAsk = Number(row.pe?.ask || row.pe?.ltp || 0);

                return (
                  <tr
                    key={String(strike)}
                    className={`border-b border-terminal-border/30 ${rowClass}`}
                    data-selected={ceSelected || peSelected ? "true" : "false"}
                    aria-selected={ceSelected || peSelected}
                  >
                    {showGreeks ? (
                      <>
                        <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                          <GreekCell value={row.ce?.greeks?.theta || 0} kind="theta" />
                        </td>
                        <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                          <GreekCell value={row.ce?.greeks?.delta || 0} kind="delta" />
                        </td>
                      </>
                    ) : (
                      <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                        <GreekCell value={row.ce?.greeks?.delta || 0} kind="delta" />
                      </td>
                    )}
                    {showSecondary ? (
                      <>
                        <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                          <ValueWithFreshness showStale={showStale}>
                            <NumericValue value={row.ce?.oi} kind="volume" />
                          </ValueWithFreshness>
                        </td>
                        <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                          <OiChangeCell value={Number(row.ce?.oi_change || 0)} />
                        </td>
                        <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                          <NumericValue value={row.ce?.volume} kind="volume" />
                        </td>
                      </>
                    ) : null}
                    <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                      <GreekCell value={row.ce?.iv || 0} kind="iv" />
                    </td>
                    <td className={`${NUM_CELL} ${CALL_SIDE}`}>{formatDisplayMoney(ceBid)}</td>
                    <td className={`${NUM_CELL} ${CALL_SIDE}`}>{formatDisplayMoney(ceAsk)}</td>
                    <td className={`${NUM_CELL} ${CALL_SIDE}`}>{formatDisplayMoney(Math.max(0, ceAsk - ceBid))}</td>
                    <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                      <ValueWithFreshness showStale={showStale}>{renderLegButton(row, "CE")}</ValueWithFreshness>
                    </td>
                    <td className={STRIKE_CELL}>
                      <span className="ot-type-data tabular-nums">{formatPrice(strike, { decimals: 0 })}</span>
                      {isAtm ? (
                        <span className="ml-1 rounded border border-terminal-accent/40 bg-terminal-accent/10 px-1 ot-type-label-compact uppercase text-terminal-accent">
                          ATM
                        </span>
                      ) : null}
                      {ceSelected || peSelected ? (
                        <span className="ml-1 rounded border border-terminal-border px-1 ot-type-label-compact uppercase text-terminal-text">
                          SEL
                        </span>
                      ) : null}
                    </td>
                    <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                      <ValueWithFreshness showStale={showStale}>{renderLegButton(row, "PE")}</ValueWithFreshness>
                    </td>
                    <td className={`${NUM_CELL} ${PUT_SIDE}`}>{formatDisplayMoney(peBid)}</td>
                    <td className={`${NUM_CELL} ${PUT_SIDE}`}>{formatDisplayMoney(peAsk)}</td>
                    <td className={`${NUM_CELL} ${PUT_SIDE}`}>{formatDisplayMoney(Math.max(0, peAsk - peBid))}</td>
                    <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                      <GreekCell value={row.pe?.iv || 0} kind="iv" />
                    </td>
                    {showSecondary ? (
                      <>
                        <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                          <NumericValue value={row.pe?.volume} kind="volume" />
                        </td>
                        <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                          <OiChangeCell value={Number(row.pe?.oi_change || 0)} />
                        </td>
                        <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                          <ValueWithFreshness showStale={showStale}>
                            <NumericValue value={row.pe?.oi} kind="volume" />
                          </ValueWithFreshness>
                        </td>
                      </>
                    ) : null}
                    {showGreeks ? (
                      <>
                        <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                          <GreekCell value={row.pe?.greeks?.delta || 0} kind="delta" />
                        </td>
                        <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                          <GreekCell value={row.pe?.greeks?.theta || 0} kind="theta" />
                        </td>
                      </>
                    ) : (
                      <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                        <GreekCell value={row.pe?.greeks?.delta || 0} kind="delta" />
                      </td>
                    )}
                  </tr>
                );
              })}
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={sideColSpan * 2 + 1} className="px-2 py-3 text-center text-terminal-muted ot-type-ui">
                    No strikes found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Phone contract cards — one side at a time */}
        <div className="space-y-2 p-2 md:hidden" data-testid="option-chain-mobile-cards">
          {sorted.map((row) => {
            const side: OptionSide = mobileSide === "calls" ? "CE" : "PE";
            const leg = side === "CE" ? row.ce : row.pe;
            if (!leg) return null;
            const strike = Number(row.strike_price);
            const selectedHere = isSelected(selected, side, strike);
            const bid = Number(leg.bid || 0);
            const ask = Number(leg.ask || leg.ltp || 0);
            const isAtm = Math.abs(strike - atmStrike) < 1e-9;
            return (
              <button
                key={`${side}-${strike}`}
                type="button"
                className={`flex w-full min-h-11 flex-col gap-1 rounded border px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terminal-accent ${
                  selectedHere
                    ? "border-terminal-accent bg-terminal-accent/10 ring-2 ring-terminal-accent/40"
                    : "border-terminal-border bg-terminal-bg/40"
                }`}
                aria-pressed={selectedHere}
                aria-label={`${optionTypeLabel(side)} ${strike}, bid ${bid}, ask ${ask}, delta ${leg.greeks?.delta ?? 0}${selectedHere ? ", selected" : ""}`}
                data-testid={`option-card-${side}-${strike}`}
                onClick={() => selectLeg(row, side)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-terminal-text">
                    {optionTypeLabel(side)} {formatPrice(strike, { decimals: 0 })}
                    {isAtm ? " · ATM" : ""}
                    {selectedHere ? " · Selected" : ""}
                  </span>
                  <span className="text-sm text-terminal-accent">{formatDisplayMoney(Number(leg.ltp || ask))}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-terminal-muted">
                  <span>Bid {formatDisplayMoney(bid)}</span>
                  <span>Ask {formatDisplayMoney(ask)}</span>
                  <span>Spread {formatDisplayMoney(Math.max(0, ask - bid))}</span>
                  <span>Delta {formatGreek(Number(leg.greeks?.delta || 0), "delta")}</span>
                  <span>IV {formatGreek(Number(leg.iv || 0), "iv")}</span>
                  <span>Vol {Number(leg.volume || 0).toLocaleString("en-US")}</span>
                </div>
              </button>
            );
          })}
          {sorted.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-terminal-muted">No strikes found</div>
          ) : null}
        </div>
      </div>

      {selected && detailOpen ? (
        <details open className="rounded border border-terminal-border bg-terminal-panel p-3" data-testid="option-contract-detail">
          <summary className="cursor-pointer text-sm font-semibold text-terminal-text">
            Contract detail · {optionTypeLabel(selected.side)} {formatPrice(selected.strike, { decimals: 0 })}
          </summary>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-terminal-muted">Bid</dt>
              <dd className="text-terminal-text">{formatDisplayMoney(selected.bid)}</dd>
            </div>
            <div>
              <dt className="text-terminal-muted">Ask</dt>
              <dd className="text-terminal-text">{formatDisplayMoney(selected.ask)}</dd>
            </div>
            <div>
              <dt className="text-terminal-muted">Spread</dt>
              <dd className="text-terminal-text">{formatDisplayMoney(selected.spread)}</dd>
            </div>
            <div>
              <dt className="text-terminal-muted">Delta</dt>
              <dd className="text-terminal-text">{formatGreek(selected.delta, "delta")}</dd>
            </div>
            <div>
              <dt className="text-terminal-muted">IV</dt>
              <dd className="text-terminal-text">{formatGreek(selected.iv, "iv")}</dd>
            </div>
            <div>
              <dt className="text-terminal-muted">Volume</dt>
              <dd className="text-terminal-text">{selected.volume.toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt className="text-terminal-muted">Open interest</dt>
              <dd className="text-terminal-text">{selected.oi.toLocaleString("en-US")}</dd>
            </div>
            <div>
              <dt className="text-terminal-muted">Last</dt>
              <dd className="text-terminal-text">{formatDisplayMoney(selected.ltp)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={`${TOUCH} rounded border border-terminal-border px-3 text-xs text-terminal-muted`}
              onClick={() => {
                try {
                  const key = "fno_strategy_pending_legs";
                  const raw = localStorage.getItem(key);
                  const current = raw
                    ? (JSON.parse(raw) as Array<{ side: OptionSide; strike: number; ltp: number }>)
                    : [];
                  current.push({ side: selected.side, strike: selected.strike, ltp: selected.ltp });
                  localStorage.setItem(key, JSON.stringify(current));
                  window.dispatchEvent(new Event("fno:add-leg"));
                } catch {
                  // ignore
                }
              }}
            >
              Add to Strategy
            </button>
          </div>
        </details>
      ) : null}

      <PaperOptionOrderTicket
        selected={selected}
        underlying={underlying}
        expiry={expiry}
        onClear={() => {
          setSelected(null);
          setDetailOpen(false);
        }}
      />
    </div>
  );
}
