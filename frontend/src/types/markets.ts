export type CountryCode = "US";

/** First-release exchanges with tested REST + streaming support. */
export type MarketCode = "NYSE" | "NASDAQ";

export const COUNTRY_MARKETS: Record<CountryCode, MarketCode[]> = {
  US: ["NASDAQ", "NYSE"],
};
