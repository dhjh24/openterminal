export const OFFLINE_BANNER_TEXT =
  "Offline — live market data and trading actions are unavailable.";

export function isBrowserOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

/** Block trading, alert persistence, and account mutations while offline. */
export function assertOnlineForAction(actionLabel = "This action"): void {
  if (!isBrowserOnline()) {
    throw new Error(`${OFFLINE_BANNER_TEXT} ${actionLabel} requires a network connection.`);
  }
}
