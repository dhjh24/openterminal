import {
  CandlestickChart,
  Sigma,
  BriefcaseBusiness,
  ShieldAlert,
  Settings2,
} from "lucide-react";

import type { WorkspacePreset } from "./TerminalShell";
import { WORKSPACE_PRESET_CONFIGS } from "../../workspace/presets";

const PRESET_META: Array<{
  id: WorkspacePreset;
  icon: typeof CandlestickChart;
  description: string;
}> = [
  {
    id: "trader",
    icon: CandlestickChart,
    description: "Charts, watchlist, alerts, and execution paths for active trading.",
  },
  {
    id: "quant",
    icon: Sigma,
    description: "Screener, backtests, and research panels for systematic work.",
  },
  {
    id: "pm",
    icon: BriefcaseBusiness,
    description: "Portfolio, risk, and allocation views for portfolio management.",
  },
  {
    id: "risk",
    icon: ShieldAlert,
    description: "Risk dashboards, exposure, and compliance-oriented monitors.",
  },
  {
    id: "ops",
    icon: Settings2,
    description: "Ops health, feeds, and platform controls for desk operations.",
  },
];

type Props = {
  open: boolean;
  preset: WorkspacePreset;
  onSelect: (preset: WorkspacePreset) => void;
  onClose: () => void;
};

export function WorkspacePresetSheet({ open, preset, onSelect, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Workspace presets">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close presets" onClick={onClose} />
      <div
        className="absolute bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] left-2 right-2 mx-auto max-h-[70dvh] max-w-lg overflow-y-auto rounded-xl border border-terminal-border bg-terminal-panel p-3 shadow-2xl"
        data-testid="workspace-preset-sheet"
      >
        <div className="mb-2 px-1">
          <div className="text-base font-semibold text-terminal-text">Workspace preset</div>
          <div className="text-sm text-terminal-muted">
            Presets change layout and quick links. They are not separate pages.
          </div>
        </div>
        <ul className="space-y-2">
          {PRESET_META.map((item) => {
            const Icon = item.icon;
            const label = WORKSPACE_PRESET_CONFIGS[item.id].label;
            const active = preset === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`flex min-h-14 w-full items-start gap-3 rounded-md border px-3 py-3 text-left ${
                    active
                      ? "border-terminal-accent bg-terminal-accent/10 text-terminal-accent"
                      : "border-terminal-border text-terminal-text"
                  }`}
                  aria-pressed={active}
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
                  <Icon size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-base font-semibold">{label}</span>
                    <span className="mt-0.5 block text-sm text-terminal-muted">{item.description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

type TriggerProps = {
  preset: WorkspacePreset;
  onOpen: () => void;
};

export function WorkspacePresetTrigger({ preset, onOpen }: TriggerProps) {
  const label = WORKSPACE_PRESET_CONFIGS[preset].label;
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-terminal-border bg-terminal-bg px-3 text-sm text-terminal-text md:hidden"
      aria-haspopup="dialog"
      aria-label={`Workspace preset: ${label}. Open preset selector.`}
      onClick={onOpen}
      data-testid="workspace-preset-trigger"
    >
      <CandlestickChart size={18} aria-hidden="true" />
      <span className="font-medium">{label}</span>
      <span aria-hidden="true" className="text-terminal-muted">
        ▾
      </span>
    </button>
  );
}
