/**
 * U.S. symbol validation for options trading.
 *
 * Rejects foreign indices (N225), suffixes (.NS, .BO), and other non-US patterns
 * when the market profile is set to US-only.
 */
import { isUsOnly } from "../../config/marketProfile";

/** Patterns that identify non-US symbols. */
const FOREIGN_PATTERNS = [
  /\.NS$/i,
  /\.BO$/i,
  /^N225$/i,
  /^NIFTY$/i,
  /^BANKNIFTY$/i,
  /^SENSEX$/i,
  /^BSESN$/i,
  /^HANG\s*SENG/i,
  /^HSI$/i,
  /^NIKKEI/i,
  /^FTSE/i,
  /^DAX/i,
  /^CAC/i,
  /^EUSTX/i,
] as const;

/** Known US-market symbols (expanded from DEFAULT_FNO_SYMBOLS). */
const US_ONLY_SYMBOLS = new Set([
  "SPY", "QQQ", "IWM", "DIA", "SPX", "VIX",
  "AAPL", "MSFT", "NVDA", "AMD", "TSLA", "AMZN", "META", "GOOGL",
  "GOOG", "NFLX", "DIS", "BA", "JPM", "V", "MA", "UNH", "HD", "CRM",
  "INTC", "CSCO", "PEP", "KO", "WMT", "PG", "XOM", "CVX", "JNJ", "MRK",
  "LLY", "ABBV", "TMO", "AVGO", "ORCL", "ADBE", "ACN", "COST", "TMUS",
  "NEE", "DHR", "RTX", "LOW", "T", "CMCSA", "HON", "UPS", "MS",
  "CAT", "IBM", "GS", "AXP", "BLK", "SCHW", "SBUX", "MCD", "NKE",
  "GME", "AMC", "PLTR", "SOFI", "RIVN", "LCID", "HOOD",
]);

/**
 * Check whether a symbol is valid for the current market profile.
 * In US-only mode, returns false for foreign patterns and true otherwise.
 * In non-US mode, allows everything.
 */
export function isValidForMarketProfile(symbol: string): boolean {
  if (!symbol || !symbol.trim()) return false;
  const cleaned = symbol.trim().toUpperCase();
  if (!isUsOnly()) return true;
  return !FOREIGN_PATTERNS.some((pattern) => pattern.test(cleaned));
}

/**
 * Get invalid-reason string, or null if the symbol is acceptable.
 */
export function getSymbolValidationError(symbol: string): string | null {
  if (!symbol || !symbol.trim()) return "Enter a symbol";
  const cleaned = symbol.trim().toUpperCase();
  if (!isUsOnly()) return null;
  for (const pattern of FOREIGN_PATTERNS) {
    if (pattern.test(cleaned)) {
      return `"${cleaned}" is not a U.S. symbol — enter a valid U.S. ticker`;
    }
  }
  if (cleaned.length < 1) return "Enter a symbol";
  return null;
}

/**
 * Resolve a stored/restored symbol to a safe US symbol.
 * If the stored value is invalid for US mode, returns "SPY".
 * Always returns the symbol uppercased and trimmed.
 */
export function resolveFnoSymbol(stored: string | null | undefined): string {
  const cleaned = (stored || "").trim().toUpperCase();
  if (!cleaned) return "SPY";
  if (isValidForMarketProfile(cleaned)) return cleaned;
  // Migrate invalid persisted symbol
  try {
    localStorage.removeItem("fno:selectedSymbol");
  } catch { /* ignore */ }
  return "SPY";
}

/**
 * Check if a symbol is in the known US-only set.
 */
export function isKnownUsSymbol(symbol: string): boolean {
  return US_ONLY_SYMBOLS.has(symbol.trim().toUpperCase());
}
