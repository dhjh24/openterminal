import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ErrorBoundary } from "../common/ErrorBoundary";
import { InstallPromptBanner } from "./InstallPromptBanner";
import { OfflineBanner } from "./OfflineBanner";
import { UpdateAvailableBanner } from "./UpdateAvailableBanner";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileHeader } from "./MobileHeader";
import { MobileSearchSheet } from "./MobileSearchSheet";
import { WorkspacePresetSheet, WorkspacePresetTrigger } from "./WorkspacePresetSheet";
import { WorkspacePresetSelector } from "./WorkspacePresetSelector";
import { WorkspaceOnboardingDialog } from "./WorkspaceOnboardingDialog";
import { IconRail } from "./IconRail";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";
import { CommandBar } from "./CommandBar";
import { CommandPalette } from "./CommandPalette";
import { TickerTape } from "./TickerTape";
import { executeParsedCommand, parseCommand } from "./commanding";
import { useSettingsStore } from "../../store/settingsStore";
import { HudOverlay } from "./HudOverlay";
import { AlertToasts } from "./AlertToasts";
import { OverlayPortal } from "./OverlayRegion";
import { useAuth } from "../../contexts/AuthContext";
import { useNotificationStore } from "../../store/notificationStore";
import type { ThemeVariant } from "../../store/settingsStore";
import { TerminalSelect } from "../terminal/TerminalSelect";
import { HotKeyPanelFloat } from "../trading/HotKeyPanelFloat";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { ShortcutOverlay } from "../common/ShortcutOverlay";
import {
  resolveShellChromeMode,
  shellChromeVisibility,
} from "../../home/shellChrome";
import {
  WORKSPACE_PRESET_STORAGE_KEY,
  announceWorkspacePresetChange,
  getWorkspacePresetConfig,
  hasCompletedWorkspaceOnboarding,
  markWorkspaceOnboardingComplete,
  writeWorkspacePreset,
  type WorkspacePreset,
} from "../../workspace/presets";

export type { WorkspacePreset };

type TerminalShellContextValue = {
  preset: WorkspacePreset;
  setPreset: (preset: WorkspacePreset) => void;
  rightRailOpen: boolean;
  setRightRailOpen: (open: boolean) => void;
  toggleRightRail: () => void;
};

const TerminalShellContext = createContext<TerminalShellContextValue | null>(null);
type RightRailSection = {
  id: string;
  title: string;
  content: ReactNode;
};

type Props = {
  children: ReactNode;
  contentClassName?: string;
  hideTickerLoader?: boolean;
  statusBarTickerOverride?: string;
  showInstallPrompt?: boolean;
  showMobileBottomNav?: boolean;
  workspacePresetStorageKey?: string;
  defaultPreset?: WorkspacePreset;
  showWorkspaceControls?: boolean;
  rightRailTitle?: string;
  rightRailSections?: RightRailSection[];
  rightRailContent?: ReactNode;
  defaultRightRailOpen?: boolean;
  rightRailStorageKey?: string;
};

function usePersistedState<T>(storageKey: string | undefined, fallback: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (!storageKey) return fallback;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // ignore storage failures
    }
  }, [storageKey, value]);

  return [value, setValue];
}

function DefaultRightRail({ title, sections }: { title: string; sections: RightRailSection[] }) {
  return (
    <aside className="hidden xl:flex h-full w-72 shrink-0 flex-col border-l border-terminal-border bg-terminal-panel">
      <div className="border-b border-terminal-border px-3 py-2">
        <div className="ot-type-panel-title text-terminal-accent">{title}</div>
        <div className="ot-type-panel-subtitle text-terminal-muted">Contextual tools and quick actions</div>
      </div>
      <div className="flex-1 space-y-2 overflow-auto p-2">
        {sections.map((section) => (
          <section key={section.id} className="rounded-sm border border-terminal-border bg-terminal-bg/40">
            <header className="border-b border-terminal-border px-2 py-1">
              <div className="ot-type-panel-title text-terminal-muted">{section.title}</div>
            </header>
            <div className="p-2 text-xs text-terminal-text">{section.content}</div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function WorkspaceControlBar({
  preset,
  onApply,
  onApplyAndOpen,
  rightRailEnabled,
  rightRailOpen,
  toggleRightRail,
}: {
  preset: WorkspacePreset;
  onApply: (preset: WorkspacePreset) => void;
  onApplyAndOpen: (preset: WorkspacePreset) => void;
  rightRailEnabled: boolean;
  rightRailOpen: boolean;
  toggleRightRail: () => void;
}) {
  const themeVariant = useSettingsStore((s) => s.themeVariant);
  const setThemeVariant = useSettingsStore((s) => s.setThemeVariant);
  const customAccentColor = useSettingsStore((s) => s.customAccentColor);
  const setCustomAccentColor = useSettingsStore((s) => s.setCustomAccentColor);
  const hudOverlayEnabled = useSettingsStore((s) => s.hudOverlayEnabled);
  const setHudOverlayEnabled = useSettingsStore((s) => s.setHudOverlayEnabled);
  const uiDensity = useSettingsStore((s) => s.uiDensity);
  const setUiDensity = useSettingsStore((s) => s.setUiDensity);
  const decorativeEffects = useSettingsStore((s) => s.decorativeEffects);
  const setDecorativeEffects = useSettingsStore((s) => s.setDecorativeEffects);

  return (
    <div className="flex items-center justify-between gap-2 overflow-x-auto border-b border-terminal-border bg-terminal-panel/90 px-3 py-1.5 backdrop-blur">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <span className="ot-type-label-compact text-terminal-muted">Workspace</span>
        <WorkspacePresetSelector
          variant="desktop"
          preset={preset}
          onApply={onApply}
          onApplyAndOpen={onApplyAndOpen}
        />
      </div>
      <div className="hidden shrink-0 items-center gap-2 md:flex">
        <label className="hidden items-center gap-1 text-[11px] text-terminal-muted lg:inline-flex">
          Theme
          <TerminalSelect
            size="sm"
            tone="ui"
            className="min-w-36"
            value={themeVariant}
            onChange={(e) => setThemeVariant(e.target.value as ThemeVariant)}
          >
            <option value="terminal-noir">Terminal Noir</option>
            <option value="classic-bloomberg">Classic Bloomberg</option>
            <option value="light-desk">Light Desk</option>
            <option value="custom">Custom</option>
          </TerminalSelect>
        </label>
        {themeVariant === "custom" ? (
          <input
            type="color"
            className="hidden h-6 w-8 cursor-pointer rounded-sm border border-terminal-border bg-transparent p-0 lg:block"
            aria-label="Custom accent color"
            value={customAccentColor}
            onChange={(e) => setCustomAccentColor(e.target.value)}
          />
        ) : null}
        <button
          type="button"
          onClick={() => setUiDensity(uiDensity === "comfortable" ? "compact" : "comfortable")}
          className={`hidden rounded-sm border px-2 py-1 ot-type-label-compact md:inline-flex ${
            uiDensity === "comfortable"
              ? "border-terminal-accent text-terminal-accent"
              : "border-terminal-border text-terminal-muted hover:text-terminal-text"
          }`}
          title="Toggle table density"
        >
          {uiDensity === "comfortable" ? "Comfortable" : "Compact"}
        </button>
        <button
          type="button"
          onClick={() => setDecorativeEffects(!decorativeEffects)}
          className={`hidden rounded-sm border px-2 py-1 ot-type-label-compact lg:inline-flex ${
            decorativeEffects
              ? "border-terminal-accent text-terminal-accent"
              : "border-terminal-border text-terminal-muted hover:text-terminal-text"
          }`}
          title="Toggle scanlines, vignette, and animated background"
        >
          {decorativeEffects ? "FX On" : "FX Off"}
        </button>
        <button
          type="button"
          onClick={() => setHudOverlayEnabled(!hudOverlayEnabled)}
          className={`hidden rounded-sm border px-2 py-1 ot-type-label-compact xl:inline-flex ${
            hudOverlayEnabled
              ? "border-terminal-accent text-terminal-accent"
              : "border-terminal-border text-terminal-muted hover:text-terminal-text"
          }`}
        >
          {hudOverlayEnabled ? "HUD On" : "HUD Off"}
        </button>
        {rightRailEnabled ? (
          <button
            type="button"
            onClick={toggleRightRail}
            className={`hidden xl:inline-flex rounded-sm border px-2 py-1 ot-type-label-compact ${
              rightRailOpen
                ? "border-terminal-accent text-terminal-accent"
                : "border-terminal-border text-terminal-muted hover:text-terminal-text"
            }`}
          >
            {rightRailOpen ? "Hide Context Rail" : "Show Context Rail"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TerminalShell({
  children,
  contentClassName = "",
  hideTickerLoader = false,
  statusBarTickerOverride,
  showInstallPrompt = false,
  showMobileBottomNav = false,
  workspacePresetStorageKey,
  defaultPreset = "trader",
  showWorkspaceControls = true,
  rightRailTitle = "Context Rail",
  rightRailSections,
  rightRailContent,
  defaultRightRailOpen = false,
  rightRailStorageKey,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [preset, setPreset] = usePersistedState<WorkspacePreset>(
    workspacePresetStorageKey ?? WORKSPACE_PRESET_STORAGE_KEY,
    defaultPreset,
  );
  const [rightRailOpen, setRightRailOpen] = usePersistedState<boolean>(
    rightRailStorageKey,
    defaultRightRailOpen,
  );
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [presetSheetOpen, setPresetSheetOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [presetAnnouncement, setPresetAnnouncement] = useState("");
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const { isInitializing, isAuthenticated } = useAuth();
  const shellChromeMode = useSettingsStore((s) => s.shellChromeMode);

  useKeyboardShortcuts();

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const effectiveChromeMode = useMemo(
    () => resolveShellChromeMode(shellChromeMode, location.pathname, viewportWidth),
    [location.pathname, shellChromeMode, viewportWidth],
  );
  const chrome = useMemo(() => shellChromeVisibility(effectiveChromeMode), [effectiveChromeMode]);

  const hasRightRail = Boolean(rightRailContent) || Boolean(rightRailSections?.length);
  const mobileNavEnabled = showMobileBottomNav;
  const mobileContentPad = mobileNavEnabled
    ? "pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-0"
    : "";
  const showDesktopWorkspaceControls = showWorkspaceControls && chrome.workspaceControls;
  const showDesktopContextRail = hasRightRail && rightRailOpen && chrome.contextRail;

  const shellCtx = useMemo<TerminalShellContextValue>(
    () => ({
      preset,
      setPreset,
      rightRailOpen,
      setRightRailOpen,
      toggleRightRail: () => setRightRailOpen(!rightRailOpen),
    }),
    [preset, setPreset, rightRailOpen, setRightRailOpen],
  );

  useEffect(() => {
    if (isInitializing || !isAuthenticated) return;

    const poll = async () => {
      try {
        await fetchUnreadCount();
      } catch {
        // Non-fatal: store already records lastError without rethrowing.
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [fetchUnreadCount, isInitializing, isAuthenticated]);

  useEffect(() => {
    if (!showWorkspaceControls) return;
    if (hasCompletedWorkspaceOnboarding()) return;
    setOnboardingOpen(true);
  }, [showWorkspaceControls]);

  const applyPreset = (nextPreset: WorkspacePreset, options?: { openLanding?: boolean }) => {
    setPreset(nextPreset);
    // Persist immediately so Apply-and-open navigation does not remount with a stale preset.
    writeWorkspacePreset(nextPreset);
    const config = getWorkspacePresetConfig(nextPreset);
    const announcement = options?.openLanding
      ? `Switched to ${config.label} workspace and opened ${config.landing.headline}.`
      : `Switched to ${config.label} workspace. Primary action is now ${config.landing.primaryLabel}.`;
    setPresetAnnouncement(announcement);
    announceWorkspacePresetChange(nextPreset, { opened: Boolean(options?.openLanding) });
    if (options?.openLanding) {
      navigate(config.landing.primaryRoute);
    }
  };

  const finishOnboarding = (nextPreset?: WorkspacePreset) => {
    markWorkspaceOnboardingComplete();
    setOnboardingOpen(false);
    if (nextPreset) {
      applyPreset(nextPreset);
    }
  };

  return (
    <TerminalShellContext.Provider value={shellCtx}>
      <div
        className="ot-app-shell flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-terminal-bg text-terminal-text"
        data-testid="terminal-shell-chrome"
        data-shell-chrome={effectiveChromeMode}
      >
        {chrome.iconRail ? <IconRail /> : null}

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <OfflineBanner />

          {/* Phone compact header — replaces stacked desktop chrome below md */}
          {mobileNavEnabled ? (
            <MobileHeader
              onSearchOpen={() => {
                setMobileMoreOpen(false);
                setMobileSearchOpen(true);
              }}
            />
          ) : null}

          {/* Desktop command bar / tape / top bar — hidden on phone when mobile nav is active */}
          <div className={mobileNavEnabled ? "hidden md:contents" : "contents"}>
            {chrome.commandBar ? (
              <CommandBar
                onExecute={async (command) => {
                  const parsed = parseCommand(command);
                  return executeParsedCommand(parsed, navigate);
                }}
              />
            ) : null}
            {chrome.tickerTape ? <TickerTape /> : null}
            {chrome.topBar ? <TopBar hideTickerLoader={hideTickerLoader} /> : null}
          </div>

          {showDesktopWorkspaceControls ? (
            <div className={mobileNavEnabled ? "hidden md:block" : undefined}>
              <WorkspaceControlBar
                preset={preset}
                onApply={(next) => applyPreset(next)}
                onApplyAndOpen={(next) => applyPreset(next, { openLanding: true })}
                rightRailEnabled={hasRightRail}
                rightRailOpen={rightRailOpen}
                toggleRightRail={() => setRightRailOpen(!rightRailOpen)}
              />
            </div>
          ) : null}

          {/* Phone-only workspace switcher when desktop chrome is collapsed */}
          {showWorkspaceControls && mobileNavEnabled ? (
            <div className="flex items-center gap-2 border-b border-terminal-border bg-terminal-panel/80 px-2 py-1.5 md:hidden">
              <WorkspacePresetTrigger preset={preset} onOpen={() => setPresetSheetOpen(true)} />
              <span className="text-[12px] text-terminal-muted">Active workspace</span>
            </div>
          ) : null}

          <div className="ot-route-layer flex min-h-0 flex-1 overflow-hidden">
            <ErrorBoundary>
              <div
                className={`relative z-0 min-h-0 min-w-0 flex-1 overflow-auto ${mobileContentPad} ${contentClassName}`.trim()}
              >
                {children}
              </div>
            </ErrorBoundary>
            {showDesktopContextRail
              ? rightRailContent ?? (
                  <DefaultRightRail title={rightRailTitle} sections={rightRailSections ?? []} />
                )
              : null}
          </div>
          {chrome.statusBar ? (
            <div className={mobileNavEnabled ? "hidden md:block" : undefined}>
              <StatusBar tickerOverride={statusBarTickerOverride} />
            </div>
          ) : null}
        </div>

        <OverlayPortal>
          <div className="ot-overlay-notices" data-testid="overlay-notices">
            <UpdateAvailableBanner />
            {showInstallPrompt ? <InstallPromptBanner /> : null}
            <AlertToasts />
          </div>
        </OverlayPortal>
        {mobileNavEnabled ? (
          <MobileBottomNav
            forceMoreOpen={mobileMoreOpen}
            onMoreOpenChange={setMobileMoreOpen}
          />
        ) : null}
        {mobileNavEnabled ? (
          <MobileSearchSheet open={mobileSearchOpen} onClose={() => setMobileSearchOpen(false)} />
        ) : null}
        <WorkspacePresetSheet
          open={presetSheetOpen}
          preset={preset}
          onApply={(next) => applyPreset(next)}
          onApplyAndOpen={(next) => applyPreset(next, { openLanding: true })}
          onClose={() => setPresetSheetOpen(false)}
        />
        <WorkspaceOnboardingDialog
          open={onboardingOpen}
          onSelect={(next) => finishOnboarding(next)}
          onSkip={() => finishOnboarding()}
        />
        <div className="sr-only" role="status" aria-live="polite" data-testid="workspace-preset-announcement">
          {presetAnnouncement}
        </div>
        <div className="hidden md:contents">
          <HotKeyPanelFloat />
        </div>
        <CommandPalette />
        <HudOverlay />
        <div className="hidden md:contents">
          <ShortcutOverlay />
        </div>
      </div>
    </TerminalShellContext.Provider>
  );
}

export function useTerminalShellWorkspace() {
  const ctx = useContext(TerminalShellContext);
  if (!ctx) {
    throw new Error("useTerminalShellWorkspace must be used within TerminalShell");
  }
  return ctx;
}
