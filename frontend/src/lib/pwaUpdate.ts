/**
 * PWA update notification listener.
 *
 * Update UI is rendered by UpdateAvailableBanner inside the shared overlay stack.
 * This module only tracks controllerchange for diagnostics — it must not inject
 * an independent fixed DOM banner (Issue #25 overlay collisions).
 */

function init(): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // UpdateAvailableBanner / useServiceWorkerUpdate owns the user-facing notice.
  });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
