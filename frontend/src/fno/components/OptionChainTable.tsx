import { useMemo, useState, type ReactNode } from "react";

import { NumericValue } from "../../components/terminal/NumericValue";
import { useDisplayCurrency } from "../../hooks/useDisplayCurrency";
import { formatGreek, formatPrice, formatSignedNumber, isMissingNumber } from "../../lib/format";
import type { StrikeData } from "../types/fno";
import { optionTypeLabel } from "../types/fno";

type SortKey = "strike" | "ce_oi" | "ce_oi_change" | "pe_oi" | "pe_oi_change";

type Props = {
  rows: StrikeData[];
  atmStrike: number;
  /** ISO timestamp from chain payload — used to mark delayed rows when stale. */
  dataTimestamp?: string;
  isDelayed?: boolean;
};

const STALE_AFTER_MS = 60_000;

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
  return (
    <span className={`ot-type-data tabular-nums ${toneClass}`}>
      {formatSignedNumber(value, { decimals: 0 })}
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
      title="Delayed or stale quote"
      aria-label="Delayed data"
    >
      DLY
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

const NUM_CELL = "px-2 py-1 text-right";
const CALL_SIDE = "bg-terminal-bg/20";
const PUT_SIDE = "bg-terminal-panel/30";
const STRIKE_CELL = "px-2 py-1 text-center font-semibold border-x border-terminal-border/50 bg-terminal-panel/40";

export function OptionChainTable({ rows, atmStrike, dataTimestamp, isDelayed }: Props) {
  const { formatDisplayMoney } = useDisplayCurrency();
  const [sortKey, setSortKey] = useState<SortKey>("strike");
  const [asc, setAsc] = useState(true);
  const [showGreeks, setShowGreeks] = useState(false);
  const [selectedLeg, setSelectedLeg] = useState<{ side: "CE" | "PE"; strike: number; ltp: number } | null>(null);

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

  const colSpan = showGreeks ? 15 : 11;

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setAsc((v) => !v);
      return;
    }
    setSortKey(key);
    setAsc(true);
  };

  const headerLabel = "ot-type-table-header uppercase tracking-wide text-terminal-muted";
  const panelLabel = "ot-type-label-compact font-bold uppercase tracking-wider text-terminal-muted";

  return (
    <div className="rounded border border-terminal-border bg-terminal-panel p-0">
      <div className="flex items-center justify-between border-b border-terminal-border px-3 py-2">
        <div className={panelLabel}>Option Chain</div>
        <button
          type="button"
          onClick={() => setShowGreeks(!showGreeks)}
          className={`rounded border px-2 py-0.5 ot-type-label-compact uppercase transition-colors ${showGreeks ? "border-terminal-accent text-terminal-accent" : "border-terminal-border text-terminal-muted hover:text-terminal-text"}`}
        >
          {showGreeks ? "Hide Greeks" : "Show Greeks"}
        </button>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="min-w-full ot-type-table-cell">
          <thead className="sticky top-0 z-10 bg-terminal-panel">
            <tr className={`border-b border-terminal-border ${headerLabel}`}>
              {showGreeks && (
                <>
                  <th className={`${NUM_CELL} ${CALL_SIDE}`} colSpan={2}>
                    CE Greeks
                  </th>
                </>
              )}
              <th className={`${NUM_CELL} ${CALL_SIDE}`} colSpan={showGreeks ? 6 : 5}>
                Calls
              </th>
              <th className="px-2 py-2 text-center">Strike</th>
              <th className={`text-right ${PUT_SIDE}`} colSpan={showGreeks ? 6 : 5}>
                Puts
              </th>
            </tr>
            <tr className={`border-b border-terminal-border ${headerLabel}`}>
              {showGreeks && (
                <>
                  <th className={`${NUM_CELL} ${CALL_SIDE}`}>Theta</th>
                  <th className={`${NUM_CELL} ${CALL_SIDE}`}>Delta</th>
                </>
              )}
              <th className={`${NUM_CELL} ${CALL_SIDE}`}>OI</th>
              <th className={`${NUM_CELL} cursor-pointer ${CALL_SIDE}`} onClick={() => onSort("ce_oi_change")}>
                ΔOI
              </th>
              <th className={`${NUM_CELL} ${CALL_SIDE}`}>Vol</th>
              <th className={`${NUM_CELL} ${CALL_SIDE}`}>IV</th>
              <th className={`${NUM_CELL} ${CALL_SIDE}`}>Last</th>
              <th className={STRIKE_CELL}>Strike</th>
              <th className={`${NUM_CELL} ${PUT_SIDE}`}>Last</th>
              <th className={`${NUM_CELL} ${PUT_SIDE}`}>IV</th>
              <th className={`${NUM_CELL} ${PUT_SIDE}`}>Vol</th>
              <th className={`${NUM_CELL} cursor-pointer ${PUT_SIDE}`} onClick={() => onSort("pe_oi_change")}>
                ΔOI
              </th>
              <th className={`${NUM_CELL} ${PUT_SIDE}`}>OI</th>
              {showGreeks && (
                <>
                  <th className={`${NUM_CELL} ${PUT_SIDE}`}>Delta</th>
                  <th className={`${NUM_CELL} ${PUT_SIDE}`}>Theta</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const isAtm = Math.abs(Number(row.strike_price) - atmStrike) < 1e-9;
              const ceDoi = Number(row.ce?.oi_change || 0);
              const peDoi = Number(row.pe?.oi_change || 0);
              const rowClass = isAtm
                ? "bg-terminal-accent/5 ring-1 ring-inset ring-terminal-accent/25"
                : "hover:bg-terminal-bg/60";
              return (
                <tr key={String(row.strike_price)} className={`border-b border-terminal-border/30 ${rowClass}`}>
                  {showGreeks && (
                    <>
                      <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                        <GreekCell value={row.ce?.greeks?.theta || 0} kind="theta" />
                      </td>
                      <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                        <GreekCell value={row.ce?.greeks?.delta || 0} kind="delta" />
                      </td>
                    </>
                  )}
                  <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                    <ValueWithFreshness showStale={showStale}>
                      <NumericValue value={row.ce?.oi} kind="volume" />
                    </ValueWithFreshness>
                  </td>
                  <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                    <OiChangeCell value={ceDoi} />
                  </td>
                  <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                    <NumericValue value={row.ce?.volume} kind="volume" />
                  </td>
                  <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                    <GreekCell value={row.ce?.iv || 0} kind="iv" />
                  </td>
                  <td className={`${NUM_CELL} ${CALL_SIDE}`}>
                    <ValueWithFreshness showStale={showStale}>
                      <button
                        type="button"
                        className="ot-type-data text-terminal-accent hover:underline"
                        onClick={() =>
                          setSelectedLeg({
                            side: "CE",
                            strike: Number(row.strike_price),
                            ltp: Number(row.ce?.ltp || 0),
                          })
                        }
                      >
                        {isMissingNumber(row.ce?.ltp) ? "—" : formatDisplayMoney(Number(row.ce?.ltp))}
                      </button>
                    </ValueWithFreshness>
                  </td>
                  <td className={STRIKE_CELL}>
                    <span className="ot-type-data tabular-nums">{formatPrice(Number(row.strike_price), { decimals: 0 })}</span>
                    {isAtm ? (
                      <span className="ml-1 rounded border border-terminal-accent/40 bg-terminal-accent/10 px-1 ot-type-label-compact uppercase text-terminal-accent">
                        ATM
                      </span>
                    ) : null}
                  </td>
                  <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                    <ValueWithFreshness showStale={showStale}>
                      <button
                        type="button"
                        className="ot-type-data text-terminal-accent hover:underline"
                        onClick={() =>
                          setSelectedLeg({
                            side: "PE",
                            strike: Number(row.strike_price),
                            ltp: Number(row.pe?.ltp || 0),
                          })
                        }
                      >
                        {isMissingNumber(row.pe?.ltp) ? "—" : formatDisplayMoney(Number(row.pe?.ltp))}
                      </button>
                    </ValueWithFreshness>
                  </td>
                  <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                    <GreekCell value={row.pe?.iv || 0} kind="iv" />
                  </td>
                  <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                    <NumericValue value={row.pe?.volume} kind="volume" />
                  </td>
                  <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                    <OiChangeCell value={peDoi} />
                  </td>
                  <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                    <ValueWithFreshness showStale={showStale}>
                      <NumericValue value={row.pe?.oi} kind="volume" />
                    </ValueWithFreshness>
                  </td>
                  {showGreeks && (
                    <>
                      <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                        <GreekCell value={row.pe?.greeks?.delta || 0} kind="delta" />
                      </td>
                      <td className={`${NUM_CELL} ${PUT_SIDE}`}>
                        <GreekCell value={row.pe?.greeks?.theta || 0} kind="theta" />
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-2 py-3 text-center text-terminal-muted ot-type-ui">
                  No strikes found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedLeg && (
        <div className="border-t border-terminal-border bg-terminal-bg px-3 py-2 ot-type-ui">
          Add to Strategy:{" "}
          <span className="text-terminal-accent">
            {optionTypeLabel(selectedLeg.side)} {selectedLeg.strike}
          </span>{" "}
          @ {formatDisplayMoney(selectedLeg.ltp)}
          <button
            type="button"
            className="ml-3 rounded border border-terminal-accent px-2 py-0.5 ot-type-label-compact text-terminal-accent"
            onClick={() => {
              try {
                const key = "fno_strategy_pending_legs";
                const raw = localStorage.getItem(key);
                const current = raw
                  ? (JSON.parse(raw) as Array<{ side: "CE" | "PE"; strike: number; ltp: number }>)
                  : [];
                current.push(selectedLeg);
                localStorage.setItem(key, JSON.stringify(current));
                window.dispatchEvent(new Event("fno:add-leg"));
              } catch {
                // ignore local storage failure
              }
            }}
          >
            Add
          </button>
          <button
            type="button"
            className="ml-3 rounded border border-terminal-border px-2 py-0.5 ot-type-label-compact"
            onClick={() => setSelectedLeg(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
