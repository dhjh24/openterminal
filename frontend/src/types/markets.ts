export type CountryCode = "US";

export type MarketCode = "NYSE" | "NASDAQ" | "AMEX" | "CBOE" | "CME";

export const COUNTRY_MARKETS: Record<CountryCode, MarketCode[]> = {
  US: ["NASDAQ", "NYSE", "AMEX", "CBOE", "CME"],
};
