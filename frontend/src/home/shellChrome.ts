export type ShellChromeMode = "standard" | "focus" | "full";

export const SHELL_CHROME_MODE_STORAGE_KEY = "ot:shell:chrome-mode:v1";

/** Laptop and below desktop — dense pages default into Focus. */
export const SHELL_FOCUS_DEFAULT_MAX_WIDTH = 1439;

const FOCUS_DEFAULT_ROUTE_PREFIXES = [
  "/equity/chart-workstation",
  "/equity/tape",
  "/equity/dom",
  "/equity/order-book",
  "/fno",
] as const;

export function isShellChromeMode(value: unknown): value is ShellChromeMode {
  return value === "standard" || value === "focus" || value === "full";
}

export function isFocusDefaultRoute(pathname: string): boolean {
  const path = (pathname.split("?")[0] || pathname).toLowerCase();
  return FOCUS_DEFAULT_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export type ShellChromeVisibility = {
  iconRail: boolean;
  commandBar: boolean;
  tickerTape: boolean;
  topBar: boolean;
  workspaceControls: boolean;
  contextRail: boolean;
  statusBar: boolean;
};

/**
 * Resolve effective chrome for the current viewport/route.
 * User-selected Full always wins. Focus always wins when selected.
 * Standard may auto-upgrade to Focus on dense pages at laptop widths.
 */
export function resolveShellChromeMode(
  saved: ShellChromeMode,
  pathname: string,
  viewportWidth: number,
): ShellChromeMode {
  if (saved === "full" || saved === "focus") return saved;
  if (
    viewportWidth >= 768 &&
    viewportWidth <= SHELL_FOCUS_DEFAULT_MAX_WIDTH &&
    isFocusDefaultRoute(pathname)
  ) {
    return "focus";
  }
  return "standard";
}

export function shellChromeVisibility(mode: ShellChromeMode): ShellChromeVisibility {
  switch (mode) {
    case "full":
      return {
        iconRail: true,
        commandBar: true,
        tickerTape: true,
        topBar: true,
        workspaceControls: true,
        contextRail: true,
        statusBar: true,
      };
    case "focus":
      return {
        iconRail: false,
        commandBar: false,
        tickerTape: false,
        topBar: true,
        workspaceControls: false,
        contextRail: false,
        statusBar: true,
      };
    case "standard":
    default:
      return {
        iconRail: true,
        commandBar: true,
        tickerTape: false,
        topBar: true,
        workspaceControls: true,
        contextRail: false,
        statusBar: true,
      };
  }
}
