import { useState } from "react";
import {
  BriefcaseBusiness,
  CandlestickChart,
  ChevronDown,
  Settings2,
  ShieldAlert,
  Sigma,
  type LucideIcon,
} from "lucide-react";

import { WORKSPACE_PRESET_CONFIGS, type WorkspacePreset } from "../../workspace/presets";
import { MobileBottomSheet } from "./MobileBottomSheet";

const PRESET_ICONS: Record<WorkspacePreset, LucideIcon> = {
  trader: CandlestickChart,
  quant: Sigma,
  pm: BriefcaseBusiness,
  risk: ShieldAlert,
  ops: Settings2,
};

const PRESET_ORDER: WorkspacePreset[] = ["trader", "quant", "pm", "risk", "ops"];

type Props = {
  preset: WorkspacePreset;
  onSelect: (preset: WorkspacePreset) => void;
  /** Phone-only compact control */
  variant?: "mobile" | "desktop";
};

export function WorkspacePresetSelector({ preset, onSelect, variant = "mobile" }: Props) {
  const [open, setOpen] = useState(false);
  const current = WORKSPACE_PRESET_CONFIGS[preset];
  const CurrentIcon = PRESET_ICONS[preset];

  if (variant === "desktop") {
    return (
      <div className="flex flex-nowrap items-center gap-1" role="group" aria-label="Workspace preset">
        {PRESET_ORDER.map((id) => {
          const config = WORKSPACE_PRESET_CONFIGS[id];
          const Icon = PRESET_ICONS[id];
          const active = preset === id;
          return (
            <button
              key={id}
              type="button"
              title={config.landing.description}
              onClick={() => onSelect(id)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 ot-type-label-compact ${
                active
                  ? "border-terminal-accent bg-terminal-accent/10 text-terminal-accent"
                  : "border-terminal-border text-terminal-muted hover:text-terminal-text"
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              {config.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded border border-terminal-border bg-terminal-bg px-3 py-1.5 text-sm text-terminal-text focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
        aria-label={`Workspace preset: ${current.label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="workspace-preset-selector"
      >
        <CurrentIcon size={16} aria-hidden="true" className="text-terminal-accent" />
        <span className="font-medium">{current.label}</span>
        <ChevronDown size={16} aria-hidden="true" className="text-terminal-muted" />
      </button>

      <MobileBottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Workspace preset"
        maxHeightClassName="max-h-[70dvh]"
        aboveBottomNav
        testId="workspace-preset-sheet"
      >
        <div className="flex flex-col gap-1 p-2">
          <p className="px-2 pb-1 text-sm text-terminal-muted">
            Presets change layout defaults. They are not navigation pages.
          </p>
          {PRESET_ORDER.map((id) => {
            const config = WORKSPACE_PRESET_CONFIGS[id];
            const Icon = PRESET_ICONS[id];
            const active = preset === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onSelect(id);
                  setOpen(false);
                }}
                aria-pressed={active}
                className={`flex min-h-11 items-start gap-3 rounded border px-3 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent ${
                  active
                    ? "border-terminal-accent bg-terminal-accent/10"
                    : "border-terminal-border"
                }`}
              >
                <Icon size={20} className={active ? "text-terminal-accent" : "text-terminal-muted"} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={`block text-base font-semibold ${active ? "text-terminal-accent" : "text-terminal-text"}`}>
                    {config.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-terminal-muted">{config.landing.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </MobileBottomSheet>
    </>
  );
}
