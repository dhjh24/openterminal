type TickerEntry = {
  symbol: string;
  value: string;
  delta: string;
  up: boolean;
};

const TICKER_DATA: TickerEntry[] = [
  { symbol: "SPX", value: "5,456.50", delta: "24.30", up: true },
  { symbol: "NDX", value: "19,234.10", delta: "89.40", up: true },
  { symbol: "DJI", value: "39,120.00", delta: "110.55", up: false },
  { symbol: "SPY", value: "545.20", delta: "2.30", up: true },
  { symbol: "QQQ", value: "480.80", delta: "3.90", up: true },
  { symbol: "AAPL", value: "214.20", delta: "1.45", up: true },
  { symbol: "VIX", value: "14.42", delta: "0.38", up: false },
];

function TickerRow() {
  return (
    <div className="ot-market-ticker-row">
      {TICKER_DATA.map((item) => (
        <span key={item.symbol} className="ot-market-ticker-item">
          <span className="ot-market-ticker-symbol">{item.symbol}</span>{" "}
          <span>{item.value}</span>{" "}
          <span className={item.up ? "ot-value-up" : "ot-value-down"}>{item.up ? "?" : "?"}{item.delta}</span>
          <span className="ot-market-ticker-separator">|</span>
        </span>
      ))}
    </div>
  );
}

export function MarketTicker() {
  return (
    <div className="ot-market-ticker" aria-hidden>
      <div className="ot-market-ticker-track">
        <TickerRow />
        <TickerRow />
      </div>
    </div>
  );
}
