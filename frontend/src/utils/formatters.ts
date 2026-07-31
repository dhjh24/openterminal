/** Format currency for the U.S. trading terminal (USD / en-US). */
export function formatUsd(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "-";
  }
  const abs = Math.abs(value);
  if (abs >= 1e9) {
    return `$${(value / 1e9).toLocaleString("en-US", { maximumFractionDigits: 2 })}B`;
  }
  if (abs >= 1e6) {
    return `$${(value / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })}M`;
  }
  if (abs >= 1e3) {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** @deprecated Use formatUsd — kept as a compatibility alias for call sites. */
export const formatInr = formatUsd;

export function formatPct(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toFixed(2)}%`;
}
