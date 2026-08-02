import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

export const OVERLAY_ROOT_ID = "ot-overlay-root";

/**
 * Fixed stacking region for Agent, update/install notices, and toasts.
 * Keeps overlays out of chart labels, options tables, and mobile bottom nav.
 */
export function OverlayRegionHost() {
  return (
    <div
      id={OVERLAY_ROOT_ID}
      className="ot-overlay-stack"
      data-testid="overlay-stack"
      aria-live="polite"
    />
  );
}

export function OverlayPortal({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : document.getElementById(OVERLAY_ROOT_ID),
  );

  useEffect(() => {
    setHost(document.getElementById(OVERLAY_ROOT_ID));
  }, []);

  if (!host) {
    // Unit tests / early mount: keep notices visible without the shared host.
    return <>{children}</>;
  }
  return createPortal(children, host);
}
