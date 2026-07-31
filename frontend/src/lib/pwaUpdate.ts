/**
 * PWA update notification.
 *
 * Listens for service-worker controllerchange to detect when a new build
 * has taken over. Shows a one-time banner prompting the user to refresh.
 *
 * Imported as a side-effect module from main.tsx.
 */

let updateShownThisSession = false;

function showUpdateBanner(): void {
  if (updateShownThisSession) return;
  updateShownThisSession = true;

  const banner = document.createElement("div");
  banner.id = "ot-pwa-update-banner";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");
  banner.style.cssText = [
    "position: fixed",
    "bottom: 80px",
    "left: 50%",
    "transform: translateX(-50%)",
    "z-index: 9999",
    "background: #1f6feb",
    "color: #e6edf3",
    "font-family: ui-monospace, 'SF Mono', monospace",
    "font-size: 13px",
    "padding: 10px 18px",
    "border-radius: 4px",
    "border: 1px solid #388bfd",
    "box-shadow: 0 4px 12px rgba(0,0,0,0.4)",
    "display: flex",
    "align-items: center",
    "gap: 12px",
    "cursor: pointer",
  ].join(";");

  banner.innerHTML =
    '<span>New version available</span><button style="background:#e6edf3;color:#06080c;border:none;border-radius:2px;padding:4px 12px;font-family:inherit;font-size:12px;cursor:pointer;text-transform:uppercase;letter-spacing:0.06em">Reload</button>';

  banner.querySelector("button")?.addEventListener("click", () => {
    window.location.reload();
  });

  // Auto-dismiss after 30 seconds
  document.body.appendChild(banner);
  setTimeout(() => {
    if (banner.parentNode) banner.parentNode.removeChild(banner);
  }, 30_000);
}

function init(): void {
  if (!("serviceWorker" in navigator)) return;

  // Listen for a new SW taking over
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    showUpdateBanner();
  });
}

if (typeof window !== "undefined") {
  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
