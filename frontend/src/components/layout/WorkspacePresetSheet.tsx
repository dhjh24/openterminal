import {
  BriefcaseBusiness,
  CandlestickChart,
  Settings2,
  ShieldAlert,
  Sigma,
  type LucideIcon,
} from "lucide-react";

import {
  WORKSPACE_PRESET_CONFIGS,
  type WorkspacePreset,
} from "../../workspace/presets";

const PRESET_ICONS: Record<WorkspacePreset, LucideIcon> = {
  trader: CandlestickChart,
  quant: Sigma,
  pm: BriefcaseBusiness,
  risk: ShieldAlert,
  ops: Settings2,
};

const PRESET_ORDER: WorkspacePreset[] = ["trader", "quant", "pm", "risk", "ops"];

type Props = {
  open: boolean;
  preset: WorkspacePreset;
  onApply: (preset: WorkspacePreset) => void;
  onApplyAndOpen: (preset: WorkspacePreset) => void;
  onClose: () => void;
};

export function WorkspacePresetSheet({ open, preset, onApply, onApplyAndOpen, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Workspace switcher">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close workspace switcher" onClick={onClose} />
      <div
        className="absolute bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))] left-2 right-2 mx-auto max-h-[75dvh] max-w-lg overflow-y-auto rounded-xl border border-terminal-border bg-terminal-panel p-3 shadow-2xl"
        data-testid="workspace-preset-sheet"
      >
        <div className="mb-2 px-1">
          <div className="text-base font-semibold text-terminal-text">Workspace switcher</div>
          <div className="text-sm text-terminal-muted">
            Workspaces change pinned tools, Mission Control sections, and the primary action. They are not separate pages.
          </div>
        </div>
        <ul className="space-y-2">
          {PRESET_ORDER.map((id) => {
            const config = WORKSPACE_PRESET_CONFIGS[id];
            const Icon = PRESET_ICONS[id];
            const active = preset === id;
            return (
              <li key={id}>
                <article
                  className={`rounded-md border p-3 ${
                    active ? "border-terminal-accent bg-terminal-accent/10" : "border-terminal-border"
                  }`}
                  data-testid={`workspace-card-${id}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon size={22} className={`mt-0.5 shrink-0 ${active ? "text-terminal-accent" : "text-terminal-muted"}`} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className={`text-base font-semibold ${active ? "text-terminal-accent" : "text-terminal-text"}`}>
                        {config.label} workspace
                      </div>
                      <p className="mt-0.5 text-sm text-terminal-muted">{config.purpose}</p>
                      <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-terminal-muted">
                        Lands on {config.landing.headline}
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${config.label} pinned tools`}>
                        {config.quickLinks.map((link) => (
                          <li key={link.to} className="rounded-sm border border-terminal-border px-2 py-1 text-[11px] text-terminal-text">
                            {link.label}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="min-h-11 rounded-sm border border-terminal-border px-3 text-sm text-terminal-text"
                          onClick={() => {
                            onApply(id);
                            onClose();
                          }}
                          data-testid={`workspace-apply-${id}`}
                        >
                          Apply
                        </button>
                        <button
                          type="button"
                          className="min-h-11 rounded-sm border border-terminal-accent px-3 text-sm text-terminal-accent"
                          onClick={() => {
                            onApplyAndOpen(id);
                            onClose();
                          }}
                          data-testid={`workspace-apply-open-${id}`}
                        >
                          Apply and open {config.landing.headline}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
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
      aria-label={`${label} workspace. Open workspace switcher.`}
      onClick={onOpen}
      data-testid="workspace-preset-trigger"
    >
      <CandlestickChart size={18} aria-hidden="true" />
      <span className="font-medium">{label} workspace</span>
      <span aria-hidden="true" className="text-terminal-muted">
        ▾
      </span>
    </button>
  );
}
