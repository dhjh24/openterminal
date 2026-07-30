/** Mutable market profile — callable so tests can change it. */

/** Current effective market profile. Defaults from env but can be overridden at runtime (for tests). */
let _override: string | null = null;

export function getMarketProfile(): string {
  if (_override) return _override;
  return (import.meta.env.VITE_MARKET_PROFILE || "US").toUpperCase();
}

/** Override the market profile at runtime (for tests). Pass null to reset. */
export function setMarketProfileOverride(value: string | null): void {
  _override = value;
}

export const isUsOnly = () => {
  const profile = getMarketProfile();
  return profile === "US" || !profile;
};
