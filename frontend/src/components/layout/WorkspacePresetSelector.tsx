import { useEffect, useId, useRef, useState } from "react";
import {
  BriefcaseBusiness,
  CandlestickChart,
  ChevronDown,
  Settings2,
  ShieldAlert,
  Sigma,
  type LucideIcon,
} from "lucide-react";

import {
  WORKSPACE_PRESET_CONFIGS,
  type WorkspacePreset,
} from "../../workspace/presets";
import { MobileBottomSheet } from "./MobileBottomSheet";

const PRESET_ICONS: Record<WorkspacePreset, LucideIcon> = {
  trader: CandlestickChart,
  quant: Sigma,
  pm: BriefcaseBusiness,
  risk: ShieldAlert,
  ops: Settings2,
};

export const PRESET_ORDER: WorkspacePreset[] = ["trader", "quant", "pm", "risk", "ops"];

type Props = {
  preset: WorkspacePreset;
  onApply: (preset: WorkspacePreset) => void;
  onApplyAndOpen: (preset: WorkspacePreset) => void;
  /** Phone-only compact control uses a bottom sheet; desktop uses a popover panel. */
  variant?: "mobile" | "desktop";
};

function WorkspaceCard({
  id,
  active,
  onApply,
  onApplyAndOpen,
}: {
  id: WorkspacePreset;
  active: boolean;
  onApply: (preset: WorkspacePreset) => void;
  onApplyAndOpen: (preset: WorkspacePreset) => void;
}) {
  const config = WORKSPACE_PRESET_CONFIGS[id];
  const Icon = PRESET_ICONS[id];

  return (
    <article
      className={`rounded-md border p-3 ${
        active ? "border-terminal-accent bg-terminal-accent/10" : "border-terminal-border bg-terminal-bg/40"
      }`}
      data-testid={`workspace-card-${id}`}
      aria-current={active ? "true" : undefined}
    >
      <div className="flex items-start gap-3">
        <Icon size={20} className={active ? "text-terminal-accent" : "text-terminal-muted"} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-sm font-semibold ${active ? "text-terminal-accent" : "text-terminal-text"}`}>
              {config.label} workspace
            </h3>
            {active ? (
              <span className="rounded-sm border border-terminal-accent/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-terminal-accent">
                Active
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-terminal-muted">{config.purpose}</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-terminal-muted">
            Lands on {config.landing.headline}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${config.label} pinned tools`}>
            {config.quickLinks.map((link) => (
              <li
                key={link.to}
                className="rounded-sm border border-terminal-border px-2 py-1 text-[11px] text-terminal-text"
              >
                {link.label}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-sm border border-terminal-border px-3 text-sm text-terminal-text hover:border-terminal-accent hover:text-terminal-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
              onClick={() => onApply(id)}
              data-testid={`workspace-apply-${id}`}
            >
              Apply
            </button>
            <button
              type="button"
              className="min-h-11 rounded-sm border border-terminal-accent px-3 text-sm text-terminal-accent hover:bg-terminal-accent/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
              onClick={() => onApplyAndOpen(id)}
              data-testid={`workspace-apply-open-${id}`}
            >
              Apply and open {config.landing.headline}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function WorkspacePanelBody({
  preset,
  onApply,
  onApplyAndOpen,
}: {
  preset: WorkspacePreset;
  onApply: (preset: WorkspacePreset) => void;
  onApplyAndOpen: (preset: WorkspacePreset) => void;
}) {
  return (
    <div className="flex flex-col gap-2 p-2">
      <p className="px-1 text-sm text-terminal-muted">
        Workspaces change pinned tools, Mission Control sections, and the primary action. They are not separate pages.
      </p>
      {PRESET_ORDER.map((id) => (
        <WorkspaceCard
          key={id}
          id={id}
          active={preset === id}
          onApply={onApply}
          onApplyAndOpen={onApplyAndOpen}
        />
      ))}
    </div>
  );
}

export function WorkspacePresetSelector({
  preset,
  onApply,
  onApplyAndOpen,
  variant = "mobile",
}: Props) {
  const [open, setOpen] = useState(false);
  const current = WORKSPACE_PRESET_CONFIGS[preset];
  const CurrentIcon = PRESET_ICONS[preset];
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || variant !== "desktop") return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, variant]);

  const handleApply = (next: WorkspacePreset) => {
    onApply(next);
    setOpen(false);
  };

  const handleApplyAndOpen = (next: WorkspacePreset) => {
    onApplyAndOpen(next);
    setOpen(false);
  };

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      className="inline-flex min-h-11 items-center gap-1.5 rounded border border-terminal-border bg-terminal-bg px-3 py-1.5 text-sm text-terminal-text focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
      aria-label={`${current.label} workspace. Open workspace switcher.`}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      data-testid="workspace-preset-selector"
    >
      <CurrentIcon size={16} aria-hidden="true" className="text-terminal-accent" />
      <span className="font-medium">{current.label} workspace</span>
      <ChevronDown size={16} aria-hidden="true" className="text-terminal-muted" />
    </button>
  );

  if (variant === "desktop") {
    return (
      <div className="relative" ref={rootRef}>
        {trigger}
        {open ? (
          <div
            id={panelId}
            role="dialog"
            aria-label="Workspace switcher"
            data-testid="workspace-preset-panel"
            className="absolute left-0 top-[calc(100%+0.35rem)] z-40 max-h-[min(70vh,36rem)] w-[min(92vw,28rem)] overflow-y-auto rounded-md border border-terminal-border bg-terminal-panel shadow-2xl"
          >
            <WorkspacePanelBody preset={preset} onApply={handleApply} onApplyAndOpen={handleApplyAndOpen} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {trigger}
      <MobileBottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Workspace switcher"
        maxHeightClassName="max-h-[75dvh]"
        aboveBottomNav
        testId="workspace-preset-sheet"
      >
        <WorkspacePanelBody preset={preset} onApply={handleApply} onApplyAndOpen={handleApplyAndOpen} />
      </MobileBottomSheet>
    </>
  );
}
