import type { ChainSummary } from "../types/fno";
import { useDisplayCurrency } from "../../hooks/useDisplayCurrency";

type Props = {
  symbol: string;
  expiry: string;
  spotPrice: number;
  summary?: ChainSummary;
};

/** Render a value or em dash when data is unavailable. Distinguishes true zero from null. */
function fmtValue(value: number | null | undefined, formatter: (v: number) => string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "\u2014";
  return formatter(value);
}

function pct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function pct1(v: number): string {
  return `${v.toFixed(1)}%`;
}

function twoDec(v: number): string {
  return v.toFixed(2);
}

function isZeroish(value: number | null | undefined): boolean {
  return value != null && Number.isFinite(value) && Math.abs(value) < 0.0001;
}

export function StrikeSummaryBar({ symbol, expiry, spotPrice, summary }: Props) {
  const { formatDisplayMoney } = useDisplayCurrency();
  const hasSummary = summary != null;
  const emDash = "\u2014";

  const metrics = [
    { label: "Spot", value: hasSummary ? fmtValue(spotPrice, formatDisplayMoney) : fmtValue(null, formatDisplayMoney) },
    { label: "ATM IV", value: hasSummary ? fmtValue(summary?.atm_iv, (v) => `${v.toFixed(2)}%`) : emDash },
    { label: "IV Rank", value: hasSummary ? fmtValue(summary?.iv_rank, pct1) : emDash },
    { label: "IV Pctl", value: hasSummary ? fmtValue(summary?.iv_percentile, pct1) : emDash },
    { label: "P/C Ratio", value: hasSummary ? fmtValue(summary?.pcr?.pcr_oi, twoDec) : emDash },
    { label: "Max Pain", value: hasSummary ? fmtValue(summary?.max_pain, formatDisplayMoney) : emDash },
  ];

  return (
    <div>
      {/* Mobile: 2-column grid */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {metrics.map((m) => (
          <div key={m.label} className="rounded border border-terminal-border bg-terminal-panel/60 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-terminal-muted">{m.label}</div>
            <div className={`text-sm font-semibold tabular-nums ${m.value === emDash ? "text-terminal-muted/60" : "text-terminal-text"}`}>
              {m.value}
            </div>
          </div>
        ))}
      </div>
      {/* Desktop: 8-column grid (unchanged) */}
      <div className="hidden md:grid md:grid-cols-8 gap-2 rounded border border-terminal-border bg-terminal-panel p-3">
        <div>
          <div className="text-[10px] uppercase text-terminal-muted flex items-center gap-1">
            Symbol {summary?.market && <span className="bg-terminal-accent/20 text-terminal-accent px-1 rounded text-[8px]">{summary.market}</span>}
          </div>
          <div className="text-sm font-semibold">{symbol || emDash}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-terminal-muted">Expiry</div>
          <div className="text-sm font-semibold">{expiry || emDash}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-terminal-muted">Spot</div>
          <div className="text-sm font-semibold tabular-nums">{fmtValue(spotPrice, formatDisplayMoney)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-terminal-muted">ATM IV</div>
          <div className="text-sm font-semibold tabular-nums">{hasSummary ? fmtValue(summary?.atm_iv, (v) => `${v.toFixed(2)}%`) : emDash}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-terminal-muted">IV Rank</div>
          <div className="text-sm font-semibold tabular-nums text-terminal-accent">{hasSummary ? fmtValue(summary?.iv_rank, pct1) : emDash}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-terminal-muted">IV Pctl</div>
          <div className="text-sm font-semibold tabular-nums text-terminal-accent">{hasSummary ? fmtValue(summary?.iv_percentile, pct1) : emDash}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-terminal-muted">PCR</div>
          <div className="text-sm font-semibold tabular-nums">{hasSummary ? fmtValue(summary?.pcr?.pcr_oi, twoDec) : emDash}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-terminal-muted">Max Pain</div>
          <div className="text-sm font-semibold tabular-nums">{hasSummary ? fmtValue(summary?.max_pain, formatDisplayMoney) : emDash}</div>
        </div>
      </div>
    </div>
  );
}
