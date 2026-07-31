import { useEffect, useId, useRef } from "react";

import {
  WORKSPACE_FIRST_USE_CHOICES,
  type WorkspacePreset,
} from "../../workspace/presets";

type Props = {
  open: boolean;
  onSelect: (preset: WorkspacePreset) => void;
  onSkip: () => void;
};

export function WorkspaceOnboardingDialog({ open, onSelect, onSkip }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onSkip]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 sm:items-center" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="workspace-onboarding-dialog"
        className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-md border border-terminal-border bg-terminal-panel p-4 shadow-2xl"
      >
        <h2 id={titleId} className="text-lg font-semibold text-terminal-text">
          What do you mainly use OpenTerminal for?
        </h2>
        <p className="mt-1 text-sm text-terminal-muted">
          We will set your starting workspace. You can change it anytime from the workspace switcher.
        </p>
        <ul className="mt-4 space-y-2">
          {WORKSPACE_FIRST_USE_CHOICES.map((choice) => (
            <li key={choice.id}>
              <button
                type="button"
                className="flex min-h-14 w-full flex-col items-start rounded-md border border-terminal-border px-3 py-3 text-left hover:border-terminal-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
                onClick={() => onSelect(choice.preset)}
                data-testid={`workspace-onboarding-${choice.id}`}
              >
                <span className="text-sm font-semibold text-terminal-text">{choice.label}</span>
                <span className="mt-0.5 text-sm text-terminal-muted">{choice.description}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="min-h-11 rounded-sm border border-terminal-border px-3 text-sm text-terminal-muted hover:text-terminal-text focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
            onClick={onSkip}
            data-testid="workspace-onboarding-skip"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
