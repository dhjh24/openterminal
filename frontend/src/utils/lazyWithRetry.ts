import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const CHUNK_RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;
const CHUNK_RELOAD_KEY = "ot-lazy-chunk-reload";

function isRetryableChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("importing a module script failed") ||
    normalized.includes("loading chunk") ||
    normalized.includes("chunkloaderror") ||
    normalized.includes("dynamically imported module")
  );
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function tryRecoverWithReload(error: unknown): never | void {
  if (typeof window === "undefined" || !isRetryableChunkError(error)) {
    return;
  }
  try {
    if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") {
      window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return;
    }
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  } catch {
    return;
  }
  // Stale HTML after deploy references old hashed chunks (404). Reload once to
  // pick up the current entrypoint manifest.
  window.location.reload();
}

async function importWithRetry<T>(
  loader: () => Promise<{ default: T }>,
  attempt = 0,
): Promise<{ default: T }> {
  try {
    const mod = await loader();
    try {
      window.sessionStorage?.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      // ignore storage failures
    }
    return mod;
  } catch (error) {
    if (isRetryableChunkError(error) && attempt < CHUNK_RETRY_ATTEMPTS) {
      await wait(RETRY_DELAY_MS * (attempt + 1));
      return importWithRetry(loader, attempt + 1);
    }
    tryRecoverWithReload(error);
    throw error;
  }
}

export function lazyWithRetry<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => importWithRetry(loader));
}
