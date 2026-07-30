import { useCallback, useEffect, useRef, useState } from "react";

const DISMISS_KEY = "otui:sw-update-dismissed";

function dismissedFor(scriptURL: string): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === scriptURL;
  } catch {
    return false;
  }
}

function setDismissed(scriptURL: string): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, scriptURL);
  } catch {
    // ignore
  }
}

export type ServiceWorkerUpdateState = {
  updateAvailable: boolean;
  applyUpdate: () => void;
  dismissUpdate: () => void;
};

/**
 * Detect a waiting service worker and expose a one-shot update banner.
 * Reloads only after the user opts in (or first install claims the page).
 */
export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const refreshingRef = useRef(false);
  const userRequestedRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let cancelled = false;

    const trackWaiting = (reg: ServiceWorkerRegistration) => {
      const w = reg.waiting;
      if (w && w.state === "installed" && !dismissedFor(w.scriptURL)) {
        setWaiting(w);
      }
    };

    const onUpdateFound = () => {
      if (!registration?.installing) return;
      const installing = registration.installing;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          trackWaiting(registration!);
        }
      });
    };

    void navigator.serviceWorker.ready.then((reg) => {
      if (cancelled) return;
      registration = reg;
      trackWaiting(reg);
      reg.addEventListener("updatefound", onUpdateFound);
      // Periodic check when the tab is focused after a deploy.
      const onVisibility = () => {
        if (document.visibilityState === "visible") {
          void reg.update().catch(() => {});
        }
      };
      document.addEventListener("visibilitychange", onVisibility);
      (reg as ServiceWorkerRegistration & { _otuiCleanup?: () => void })._otuiCleanup = () => {
        reg.removeEventListener("updatefound", onUpdateFound);
        document.removeEventListener("visibilitychange", onVisibility);
      };
    });

    const onControllerChange = () => {
      if (!userRequestedRef.current) return;
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      const cleanup = (registration as ServiceWorkerRegistration & { _otuiCleanup?: () => void } | null)
        ?._otuiCleanup;
      cleanup?.();
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    userRequestedRef.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  }, [waiting]);

  const dismissUpdate = useCallback(() => {
    if (waiting) setDismissed(waiting.scriptURL);
    setWaiting(null);
  }, [waiting]);

  return {
    updateAvailable: Boolean(waiting),
    applyUpdate,
    dismissUpdate,
  };
}
