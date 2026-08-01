/** Plain-language helpers for primary navigation and tool labels. */

export type LabeledTool = {
  label: string;
  description: string;
  /** Optional short badge; never use alone without label/description. */
  badge?: string;
  badgeTitle?: string;
};

/** Expand common internal abbreviations for accessible names. */
export function accessibleToolName(label: string, description?: string): string {
  const trimmed = label.trim();
  const withDescription = description?.trim() ? `${trimmed}. ${description.trim()}` : trimmed;
  return withDescription;
}

export function badgeAccessibleTitle(badge: string, label: string): string {
  return `${badge} shortcut for ${label}`;
}

/** Canonical plain-language renames for primary surfaces. */
export const PLAIN_LANGUAGE: Record<string, string> = {
  PM: "Portfolio",
  Ops: "Operations",
  Corr: "Correlation",
  RS: "Relative strength",
  PCR: "Put/call ratio",
  OI: "Open interest",
  DOM: "Depth of market",
  OMS: "Order management",
  FNO: "Options and futures",
  MTA: "Multi-timeframe analysis",
  Lab: "Portfolio lab",
  Data: "Data quality",
  Cmd: "Command palette",
};
