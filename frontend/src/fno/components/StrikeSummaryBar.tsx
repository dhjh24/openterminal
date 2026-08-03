import type { ChainSummary } from "../types/fno";
import { useDisplayCurrency } from "../../hooks/useDisplayCurrency";

type Props = {
  symbol: string;
  expiry: string;
  spotPrice: number;
  summary?: ChainSummary;
  /** ISO timestamp from chain payload for freshness display. */
  dataTimestamp?: string;
  delayStatus?: string;
  isDelayed?: boolean;
};

const STALE_AFTER_MS = 60_000;

/** Render a value or em dash when data is unavailable. Distinguishes true zero from null. */
function fmtValue(value: number | null | undefined, formatter: (v: number) => string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "\u2014";
  return formatter(value);
}

function pct1(v: number): string {
  return `${v.toFixed(1)}%`;
}

function twoDec(v: number): string {
  return v.toFixed(2);
}

function formatFreshness(timestamp?: string, delayStatus?: string, isDelayed?: boolean): {
  label: string;
  stale: boolean;
} {
  const status = String(delayStatus || "").toLowerCase();
  if (isDelayed || status === "delayed" || status === "stale" || status === "unavailable") {
    return { label: status === "unavailable" ? "Unavailable" : "Delayed", stale: true };
  }
  if (!timestamp) return { label: "—", stale: false };
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return { label: "—", stale: false };
  const ageMs = Date.now() - parsed;
  if (ageMs > STALE_AFTER_MS) {
    return { label: "Delayed", stale: true };
  }
  try {
    return {
      label: new Date(parsed).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      stale: false,
    };
  } catch {
    return { label: "Fresh", stale: false };
  }
}

export function StrikeSummaryBar({
  symbol,
  expiry,
  spotPrice,
  summary,
  dataTimestamp,
  delayStatus,
  isDelayed,
}: Props) {
  const { formatDisplayMoney } = useDisplayCurrency();
  const hasSummary = summary != null;
  const emDash = "\u2014";
  const freshness = formatFreshness(
    dataTimestamp || summary?.timestamp,
    delayStatus || summary?.delay_status,
    isDelayed,
  );

  type Metric = { label: string; value: string; muted?: boolean; testId?: string };
  const metrics: Metric[] = [
    { label: "Spot", value: hasSummary ? fmtValue(spotPrice, formatDisplayMoney) : fmtValue(null, formatDisplayMoney) },
    { label: "ATM IV", value: hasSummary ? fmtValue(summary?.atm_iv, (v) => `${v.toFixed(2)}%`) : emDash },
    { label: "IV Rank", value: hasSummary ? fmtValue(summary?.iv_rank, pct1) : emDash },
    { label: "IV Pctl", value: hasSummary ? fmtValue(summary?.iv_percentile, pct1) : emDash },
    { label: "P/C Ratio", value: hasSummary ? fmtValue(summary?.pcr?.pcr_oi, twoDec) : emDash },
    { label: "Max Pain", value: hasSummary ? fmtValue(summary?.max_pain, formatDisplayMoney) : emDash },
    {
      label: "Data",
      value: hasSummary ? freshness.label : emDash,
      muted: !hasSummary || freshness.stale,
      testId: "option-chain-freshness-mobile",
    },
  ];

  return (
    <div>
      {/* Mobile: 2-column grid */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {metrics.map((m) => (
          <div key={m.label} className="rounded border border-terminal-border bg-terminal-panel/60 px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-terminal-muted">{m.label}</div>
            <div
              className={`text-sm font-semibold tabular-nums ${
                m.value === emDash || m.muted ? "text-terminal-muted/60" : "text-terminal-text"
              }`}
              data-testid={m.testId}
            >
              {m.value}
              {m.testId && freshness.stale ? <span className="sr-only"> (stale or delayed)</span> : null}
            </div>
          </div>
        ))}
      </div>
      {/* Desktop: symbol/expiry + metrics */}
      <div className="hidden md:grid md:grid-cols-9 gap-2 rounded border border-terminal-border bg-terminal-panel p-3">
        <div>
          <div className="text-[10px] uppercase text-terminal-muted flex items-center gap-1">
            Symbol{" "}
            {summary?.market ? (
              <span className="bg-terminal-accent/20 text-terminal-accent px-1 rounded text-[8px]">{summary.market}</span>
            ) : null}
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
          <div className="text-sm font-semibold tabular-nums">
            {hasSummary ? fmtValue(summary?.atm_iv, (v) => `${v.toFixed(2)}%`) : emDash}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-terminal-muted">IV Rank</div>
          <div className="text-sm font-semibold tabular-nums text-terminal-accent">
            {hasSummary ? fmtValue(summary?.iv_rank, pct1) : emDash}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-terminal-muted">IV Pctl</div>
          <div className="text-sm font-semibold tabular-nums text-terminal-accent">
            {hasSummary ? fmtValue(summary?.iv_percentile, pct1) : emDash}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-terminal-muted">PCR</div>
          <div className="text-sm font-semibold tabular-nums">
            {hasSummary ? fmtValue(summary?.pcr?.pcr_oi, twoDec) : emDash}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-terminal-muted">Max Pain</div>
          <div className="text-sm font-semibold tabular-nums">
            {hasSummary ? fmtValue(summary?.max_pain, formatDisplayMoney) : emDash}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-terminal-muted">Data</div>
          <div
            className={`text-sm font-semibold tabular-nums ${freshness.stale ? "text-terminal-muted" : "text-terminal-text"}`}
            data-testid="option-chain-freshness"
            aria-label={freshness.stale ? `Data ${freshness.label}` : `Data as of ${freshness.label}`}
          >
            {hasSummary ? freshness.label : emDash}
            {hasSummary && freshness.stale ? <span className="sr-only"> (stale or delayed)</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
