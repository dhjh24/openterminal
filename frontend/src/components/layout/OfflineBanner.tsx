import { OFFLINE_BANNER_TEXT } from "../../lib/offlineGuard";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";

function formatLastOnline(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function OfflineBanner() {
  const { online, lastOnlineAt } = useNetworkStatus();
  if (online) return null;

  const last = formatLastOnline(lastOnlineAt);

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] border-b border-amber-700/60 bg-amber-950/95 px-3 py-2 text-center text-xs text-amber-100"
    >
      <div className="font-medium">{OFFLINE_BANNER_TEXT}</div>
      {last ? <div className="mt-0.5 text-[11px] text-amber-200/80">Last successful connection: {last}</div> : null}
    </div>
  );
}
