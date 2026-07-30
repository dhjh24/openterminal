import { lazy, type ComponentType, type LazyExoticComponent } from "react";

const CHUNK_RETRY_ATTEMPTS = 1;
const RETRY_DELAY_MS = 400;
const RECOVERY_STORAGE_KEY = "otui:chunk-recovery";

declare const __GIT_COMMIT__: string;

function buildId(): string {
  try {
    return typeof __GIT_COMMIT__ === "string" && __GIT_COMMIT__ ? __GIT_COMMIT__ : "unknown";
  } catch {
    return "unknown";
  }
}

export function isRetryableChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("importing a module script failed") ||
    normalized.includes("loading chunk") ||
    normalized.includes("chunkloaderror") ||
    normalized.includes("dynamically imported module") ||
    normalized.includes("error loading dynamically imported module")
  );
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

function readRecoveryState(): { buildId: string; reloaded: boolean } | null {
  try {
    const raw = sessionStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { buildId?: string; reloaded?: boolean };
    if (!parsed?.buildId) return null;
    return { buildId: parsed.buildId, reloaded: Boolean(parsed.reloaded) };
  } catch {
    return null;
  }
}

function writeRecoveryState(buildId: string, reloaded: boolean): void {
  try {
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({ buildId, reloaded }));
  } catch {
    // sessionStorage may be unavailable (private mode / SSR)
  }
}

/**
 * One controlled full-page reload per build version when a hashed chunk is missing
 * (typical after a deploy while an old tab is still open). Prevents reload loops via sessionStorage.
 */
export function recoverFromStaleChunk(error: unknown): boolean {
  if (!isRetryableChunkError(error)) return false;
  if (typeof window === "undefined") return false;

  const currentBuild = buildId();
  const prior = readRecoveryState();
  if (prior && prior.buildId === currentBuild && prior.reloaded) {
    return false;
  }

  writeRecoveryState(currentBuild, true);
  // Bust HTML/SW caches for this navigation.
  const url = new URL(window.location.href);
  url.searchParams.set("_otui_chunk_recovery", currentBuild);
  window.location.replace(url.toString());
  return true;
}

export function clearChunkRecoveryState(): void {
  try {
    const prior = readRecoveryState();
    const currentBuild = buildId();
    if (prior && prior.buildId === currentBuild && prior.reloaded) {
      // Keep the flag for this build so a second failure does not loop;
      // clear only when build id changes (handled on next recovery attempt).
      return;
    }
    if (prior && prior.buildId !== currentBuild) {
      sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

async function importWithRetry<T>(
  loader: () => Promise<{ default: T }>,
  attempt = 0,
): Promise<{ default: T }> {
  try {
    const mod = await loader();
    // Successful import after a prior recovery — clear flag for future deploys.
    try {
      const prior = readRecoveryState();
      if (prior && prior.buildId !== buildId()) {
        sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    return mod;
  } catch (error) {
    if (isRetryableChunkError(error) && attempt < CHUNK_RETRY_ATTEMPTS) {
      await wait(RETRY_DELAY_MS * (attempt + 1));
      return importWithRetry(loader, attempt + 1);
    }
    if (recoverFromStaleChunk(error)) {
      // Navigation in progress; return a never-resolving promise so React.lazy does not throw twice.
      return new Promise(() => undefined);
    }
    throw error;
  }
}

export function lazyWithRetry<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => importWithRetry(loader));
}

export const __testOnly = {
  RECOVERY_STORAGE_KEY,
  buildId,
  readRecoveryState,
  writeRecoveryState,
};
