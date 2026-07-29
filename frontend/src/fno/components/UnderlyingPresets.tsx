interface Preset {
  label: string;
  underlying: string;
  exchange: string;
  strikeStep: number;
}

const US_PRESETS: Preset[] = [
  { label: "SPY", underlying: "SPY", exchange: "AMEX", strikeStep: 1 },
  { label: "QQQ", underlying: "QQQ", exchange: "AMEX", strikeStep: 1 },
  { label: "IWM", underlying: "IWM", exchange: "AMEX", strikeStep: 1 },
  { label: "AAPL", underlying: "AAPL", exchange: "NASDAQ", strikeStep: 1 },
  { label: "NVDA", underlying: "NVDA", exchange: "NASDAQ", strikeStep: 1 },
  { label: "TSLA", underlying: "TSLA", exchange: "NASDAQ", strikeStep: 1 },
  { label: "AMD", underlying: "AMD", exchange: "NASDAQ", strikeStep: 1 },
];

interface Props {
  market: "india" | "us";
  active: string;
  onSelect: (preset: Preset) => void;
}

export function UnderlyingPresets({ market: _market, active, onSelect }: Props) {
  const presets = US_PRESETS;

  return (
    <div className="flex gap-1">
      {presets.map((p) => (
        <button
          key={p.label}
          onClick={() => onSelect(p)}
          className={`rounded border px-3 py-1 text-xs font-mono transition-colors
            ${
              active === p.underlying
                ? "border-amber-500/40 bg-amber-500/20 text-amber-400"
                : "border-terminal-border text-terminal-muted hover:border-terminal-accent hover:text-terminal-text"
            }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
