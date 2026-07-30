import { useEffect, useState } from "react";

import { isRetryableChunkError } from "../../utils/lazyWithRetry";

type Props = {
  error: unknown;
  onRetry?: () => void;
};

/**
 * Shown when a lazy route chunk cannot be recovered via a single controlled reload.
 */
export function ChunkLoadRecovery({ error, onRetry }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(isRetryableChunkError(error));
  }, [error]);

  if (!visible) return null;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-terminal-bg px-6 text-center text-terminal-text">
      <h1 className="text-lg font-semibold">Application update required</h1>
      <p className="max-w-md text-sm text-terminal-muted">
        A newer version of OpenTerminal was deployed and this tab still points at removed assets. Reload
        once to pick up the latest build. If the problem continues, hard-refresh or clear site data for
        this origin.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border border-terminal-accent px-3 py-1.5 text-sm text-terminal-accent"
          onClick={() => {
            onRetry?.();
            window.location.reload();
          }}
        >
          Reload
        </button>
      </div>
    </div>
  );
}
