import { useServiceWorkerUpdate } from "../../hooks/useServiceWorkerUpdate";

export function UpdateAvailableBanner() {
  const { updateAvailable, applyUpdate, dismissUpdate } = useServiceWorkerUpdate();
  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="update-available-banner"
      className="ot-overlay-card w-full rounded border border-terminal-accent bg-terminal-panel p-3 text-xs shadow-none md:w-96"
    >
      <div className="mb-2 text-terminal-text">
        <span className="font-semibold text-terminal-accent">Update available</span>
        <span className="text-terminal-muted"> — a new OpenTerminal build is ready. Reload after saving local UI work.</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border border-terminal-accent px-2 py-1 text-terminal-accent"
          onClick={applyUpdate}
        >
          Reload to update
        </button>
        <button
          type="button"
          className="rounded border border-terminal-border px-2 py-1 text-terminal-muted"
          onClick={dismissUpdate}
        >
          Later
        </button>
      </div>
    </div>
  );
}
