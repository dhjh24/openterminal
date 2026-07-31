import { useEffect, useId, useRef, type ReactNode } from "react";

const NAV_OFFSET =
  "calc(var(--ot-mobile-nav-height, 3.5rem) + env(safe-area-inset-bottom, 0px))";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Cap sheet height; search uses ~65dvh */
  maxHeightClassName?: string;
  /** Keep sheet above bottom navigation (phone only) */
  aboveBottomNav?: boolean;
  testId?: string;
};

export function MobileBottomSheet({
  open,
  onClose,
  title,
  children,
  maxHeightClassName = "max-h-[85dvh]",
  aboveBottomNav = true,
  testId = "mobile-bottom-sheet",
}: Props) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    const focusable = sheet?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !sheet) return;
      const nodes = Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] md:hidden" data-testid={testId}>
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Close sheet"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute left-2 right-2 flex flex-col overflow-hidden rounded-t-lg border border-terminal-border bg-terminal-panel shadow-xl ${maxHeightClassName}`}
        style={{ bottom: aboveBottomNav ? NAV_OFFSET : "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-terminal-border px-3 py-2">
          <h2 id={titleId} className="text-base font-semibold text-terminal-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-terminal-border text-terminal-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-terminal-accent"
            aria-label="Close"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
