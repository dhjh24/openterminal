/** Persist whether Mission Control shows secondary desk-detail sections. */
export const HOME_DESK_DETAILS_STORAGE_KEY = "ot:home:desk-details:v1";

export function readHomeDeskDetailsExpanded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(HOME_DESK_DETAILS_STORAGE_KEY);
    if (raw == null) return false;
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

export function writeHomeDeskDetailsExpanded(expanded: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HOME_DESK_DETAILS_STORAGE_KEY, expanded ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}
