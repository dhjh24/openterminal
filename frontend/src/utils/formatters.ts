import { formatCurrency, formatPercent } from "../lib/format";

/** @deprecated Use formatCurrency(..., "USD") — US-only terminal. */
export function formatInr(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "-";
  }
  return formatCurrency(value, "USD");
}

export function formatUsd(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "-";
  }
  return formatCurrency(value, "USD");
}

export function formatPct(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "-";
  }
  return formatPercent(value, { signed: false });
}
