import { useEffect, useId, useRef, useState } from "react";

import { MobileBottomSheet } from "../layout/MobileBottomSheet";
import { QuickNavGrid, type QuickNavSection } from "./QuickNavGrid";

type Props = {
  open: boolean;
  onClose: () => void;
  sections: QuickNavSection[];
  /** Force mobile sheet even on wide viewports (tests). */
  forceMobile?: boolean;
};

function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(max-width: 767px)");
    const onChange = () => setNarrow(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return narrow;
}

export function ExploreAllToolsDialog({ open, onClose, sections, forceMobile = false }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const isNarrow = useIsNarrow();
  const useSheet = forceMobile || isNarrow;

  useEffect(() => {
    if (!open || useSheet) return undefined;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [onClose, open, useSheet]);

  if (!open) return null;

  const body = (
    <div className="p-3" data-testid="explore-all-tools-body">
      <p className="mb-3 text-sm text-terminal-muted">
        Full categorized launcher. Every advanced route stays reachable from here.
      </p>
      <QuickNavGrid ariaLabel="Explore all tools" sections={sections} columnCount={4} />
    </div>
  );

  if (useSheet) {
    return (
      <MobileBottomSheet
        open={open}
        onClose={onClose}
        title="Explore all tools"
        maxHeightClassName="max-h-[80dvh]"
        aboveBottomNav
        testId="explore-all-tools-sheet"
      >
        {body}
      </MobileBottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 z-[70]" data-testid="explore-all-tools-dialog">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close explore tools" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute left-1/2 top-[6%] z-10 flex max-h-[88vh] w-[min(96vw,56rem)] -translate-x-1/2 flex-col overflow-hidden rounded-md border border-terminal-border bg-terminal-panel shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-terminal-border px-3 py-2">
          <h2 id={titleId} className="text-base font-semibold text-terminal-text">
            Explore all tools
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-terminal-border text-terminal-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{body}</div>
      </div>
    </div>
  );
}
