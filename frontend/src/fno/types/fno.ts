export type Greeks = {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
};

export type OptionLegData = {
  oi: number;
  oi_change: number;
  volume: number;
  iv: number;
  ltp: number;
  bid: number;
  ask: number;
  price_change?: number;
  greeks: Greeks;
  /** OCC / venue contract id when provided by the adapter. */
  contract_symbol?: string | null;
  occ_symbol?: string | null;
};

export type StrikeData = {
  strike_price: number;
  ce: OptionLegData | null;
  pe: OptionLegData | null;
};

export type OptionSide = "CE" | "PE";

/** US equity options multiplier (shares per contract). */
export const OPTION_CONTRACT_MULTIPLIER = 100;

export type SelectedOptionContract = {
  side: OptionSide;
  strike: number;
  bid: number;
  ask: number;
  spread: number;
  delta: number;
  iv: number;
  volume: number;
  oi: number;
  ltp: number;
  contractSymbol: string;
};

export function optionSpread(bid: number, ask: number): number {
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return 0;
  return Math.max(0, ask - bid);
}

export function estimatedDebit(ask: number, quantity: number, multiplier = OPTION_CONTRACT_MULTIPLIER): number {
  const qty = Math.max(0, quantity);
  const premium = Number.isFinite(ask) ? Math.max(0, ask) : 0;
  return premium * qty * multiplier;
}

export function buildPaperOptionSymbol(params: {
  underlying: string;
  expiry: string;
  side: OptionSide;
  strike: number;
  contractSymbol?: string | null;
}): string {
  const occ = String(params.contractSymbol || "").trim().toUpperCase();
  if (occ) {
    return occ.includes(":") ? occ : `NASDAQ:${occ}`;
  }
  const root = String(params.underlying || "AAPL").trim().toUpperCase() || "AAPL";
  const expiryDigits = String(params.expiry || "").replace(/-/g, "").slice(2, 8); // YYMMDD
  const cp = params.side === "CE" ? "C" : "P";
  const strikeCode = Math.round(Number(params.strike) * 1000)
    .toString()
    .padStart(8, "0");
  if (expiryDigits.length === 6) {
    return `NASDAQ:${root}${expiryDigits}${cp}${strikeCode}`;
  }
  return `NASDAQ:${root}-${params.expiry}-${cp}-${params.strike}`;
}

export function selectContractFromStrike(
  row: StrikeData,
  side: OptionSide,
  underlying: string,
  expiry: string,
): SelectedOptionContract | null {
  const leg = side === "CE" ? row.ce : row.pe;
  if (!leg) return null;
  const bid = Number(leg.bid || 0);
  const ask = Number(leg.ask || leg.ltp || 0);
  const strike = Number(row.strike_price || 0);
  return {
    side,
    strike,
    bid,
    ask,
    spread: optionSpread(bid, ask),
    delta: Number(leg.greeks?.delta || 0),
    iv: Number(leg.iv || 0),
    volume: Number(leg.volume || 0),
    oi: Number(leg.oi || 0),
    ltp: Number(leg.ltp || 0),
    contractSymbol: buildPaperOptionSymbol({
      underlying,
      expiry,
      side,
      strike,
      contractSymbol: leg.contract_symbol || leg.occ_symbol,
    }),
  };
}

export type OptionChainResponse = {
  symbol: string;
  market?: "US";
  spot_price: number;
  timestamp: string;
  expiry_date: string;
  available_expiries: string[];
  atm_strike: number;
  iv_rank?: number;
  iv_percentile?: number;
  strikes: StrikeData[];
  totals: {
    ce_oi_total: number;
    pe_oi_total: number;
    ce_volume_total: number;
    pe_volume_total: number;
    pcr_oi: number;
    pcr_volume: number;
  };
};

export type OIAnalysis = {
  symbol: string;
  expiry_date: string;
  spot_price: number;
  max_pain: number;
  support_resistance: { support: number[]; resistance: number[] };
  pcr: { pcr_oi: number; pcr_volume: number; pcr_oi_change: number; signal: string };
  buildup: Array<{
    strike_price: number;
    ce_pattern: string;
    pe_pattern: string;
    ce_oi_change: number;
    pe_oi_change: number;
    ce_price_change: number;
    pe_price_change: number;
  }>;
};

export type ChainSummary = {
  symbol: string;
  market?: "US";
  expiry_date: string;
  spot_price: number;
  atm_strike: number;
  atm_iv: number;
  iv_rank?: number;
  iv_percentile?: number;
  pcr: { pcr_oi: number; pcr_volume: number; pcr_oi_change: number; signal: string };
  max_pain: number;
  support_resistance: { support: number[]; resistance: number[] };
};

export type GreeksChainResponse = {
  symbol: string;
  expiry_date: string;
  spot_price: number;
  atm_strike: number;
  strikes: StrikeData[];
};

export type FnoContextValue = {
  symbol: string;
  setSymbol: (value: string) => void;
  expiry: string;
  setExpiry: (value: string) => void;
  expiries: string[];
};

export type StrategyLeg = {
  type: "CE" | "PE";
  strike: number;
  action: "buy" | "sell";
  premium: number;
  lots: number;
  /** Contract multiplier (shares per contract). */
  lot_size: number;
  expiry: string;
};

export type StrategyPayoffPoint = { spot: number; pnl: number };

export type StrategyPayoffResponse = {
  legs: StrategyLeg[];
  payoff_at_expiry: StrategyPayoffPoint[];
  max_profit: number | "unlimited";
  max_loss: number | "unlimited";
  breakeven_points: number[];
  risk_reward_ratio: number;
  net_premium: number;
  total_margin_approx: number;
  strategy_name: string;
};

export type PCRCurrentResponse = {
  symbol: string;
  expiry_date: string;
  timestamp: string;
  pcr_oi: number;
  pcr_vol: number;
  pcr_oi_change: number;
  signal: string;
  total_ce_oi: number;
  total_pe_oi: number;
};

export type PCRHistoryPoint = {
  date: string;
  pcr_oi: number;
  pcr_vol: number;
  signal: string;
};

export type PCRByStrikePoint = {
  strike: number;
  ce_oi: number;
  pe_oi: number;
  pcr_oi: number;
  ce_vol: number;
  pe_vol: number;
  pcr_vol: number;
};

export type IvSkewResponse = {
  symbol: string;
  expiry: string;
  spot: number;
  atm_iv: number;
  iv_skew: Array<{ strike: number; ce_iv: number; pe_iv: number; moneyness: number }>;
  iv_percentile: number;
  iv_rank: number;
};

export type IvSurfaceResponse = {
  symbol: string;
  expiries: string[];
  strikes: number[];
  surface: number[][];
};

export type FlowStrikeContext = {
  atm_strike: number;
  pcr_oi: number;
  pcr_volume: number;
  strike_row: StrikeData;
};

export type OptionsFlowItem = {
  timestamp: string;
  symbol: string;
  expiry: string;
  strike: number;
  option_type: "CE" | "PE";
  volume: number;
  avg_volume: number;
  volume_ratio: number;
  oi: number;
  oi_change: number;
  premium_value: number;
  implied_vol: number;
  sentiment: "bullish" | "bearish";
  heat_score: number;
  spot_price?: number;
  chain_context?: FlowStrikeContext;
};

export type OptionsFlowSummary = {
  total_premium: number;
  bullish_premium: number;
  bearish_premium: number;
  bullish_pct: number;
  bearish_pct: number;
  top_symbols: Array<{ symbol: string; premium: number; flow_count: number }>;
  premium_by_hour: Array<{ hour: string; bullish: number; bearish: number }>;
  flow_count?: number;
};

export function optionTypeLabel(type: "CE" | "PE" | "C" | "P"): string {
  return type === "CE" || type === "C" ? "Call" : "Put";
}

export const DEFAULT_FNO_SYMBOLS = [
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "SPX",
  "VIX",
  "AAPL",
  "MSFT",
  "NVDA",
  "AMD",
  "TSLA",
  "AMZN",
  "META",
  "GOOGL",
] as const;

export function formatUsCompact(value: number): string {
  if (!Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatCurrencyUSD(value: number): string {
  if (!Number.isFinite(value)) return "-";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
