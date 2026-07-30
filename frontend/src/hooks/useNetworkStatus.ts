import { useEffect, useState } from "react";

import { isBrowserOnline } from "../lib/offlineGuard";

export type NetworkStatus = {
  online: boolean;
  lastOnlineAt: string | null;
};

const LAST_ONLINE_KEY = "otui:last-online-at";

function readLastOnlineAt(): string | null {
  try {
    return localStorage.getItem(LAST_ONLINE_KEY);
  } catch {
    return null;
  }
}

function writeLastOnlineAt(iso: string): void {
  try {
    localStorage.setItem(LAST_ONLINE_KEY, iso);
  } catch {
    // ignore
  }
}

export function useNetworkStatus(): NetworkStatus {
  const [online, setOnline] = useState(() => isBrowserOnline());
  const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(() => {
    if (isBrowserOnline()) {
      const now = new Date().toISOString();
      writeLastOnlineAt(now);
      return now;
    }
    return readLastOnlineAt();
  });

  useEffect(() => {
    const onOnline = () => {
      const now = new Date().toISOString();
      writeLastOnlineAt(now);
      setLastOnlineAt(now);
      setOnline(true);
    };
    const onOffline = () => {
      setOnline(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return { online, lastOnlineAt };
}
