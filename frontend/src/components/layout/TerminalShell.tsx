import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import { ErrorBoundary } from "../common/ErrorBoundary";
import { InstallPromptBanner } from "./InstallPromptBanner";
import { OfflineBanner } from "./OfflineBanner";
import { UpdateAvailableBanner } from "./UpdateAvailableBanner";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileHeader } from "./MobileHeader";
import { MobileSearchSheet } from "./MobileSearchSheet";
import { WorkspacePresetSheet, WorkspacePresetTrigger } from "./WorkspacePresetSheet";
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
import { useAuth } from "../../contexts/AuthContext";
import { useNotificationStore } from "../../store/notificationStore";
import type { ThemeVariant } from "../../store/settingsStore";
import { TerminalSelect } from "../terminal/TerminalSelect";
import { HotKeyPanelFloat } from "../trading/HotKeyPanelFloat";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { ShortcutOverlay } from "../common/ShortcutOverlay";
import { WORKSPACE_PRESET_STORAGE_KEY } from "../../workspace/presets";

export type WorkspacePreset = "trader" | "quant" | "pm" | "risk" | "ops";

type TerminalShellContextValue = {
  preset: WorkspacePreset;
  setPreset: (preset: WorkspacePreset) => void;
  rightRailOpen: boolean;
  setRightRailOpen: (open: boolean) => void;
  toggleRightRail: () => void;
};

const TerminalShellContext = createContext<TerminalShellContextValue | null>(null);

const PRESET_OPTIONS: Array<{ id: WorkspacePreset; label: string }> = [
  { id: "trader", label: "Trader" },
  { id: "quant", label: "Quant" },
  { id: "pm", label: "PM" },
  { id: "risk", label: "Risk" },
  { id: "ops", label: "Ops" },
];

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
  setPreset,
  rightRailEnabled,
  rightRailOpen,
  toggleRightRail,
  onOpenPresetSheet,
}: Pick<TerminalShellContextValue, "preset" | "setPreset" | "rightRailOpen" | "toggleRightRail"> & {
  rightRailEnabled: boolean;
  onOpenPresetSheet: () => void;
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

  const applyPreset = (nextPreset: WorkspacePreset) => {
    setPreset(nextPreset);
    window.dispatchEvent(new CustomEvent("ot:preset-change", { detail: nextPreset }));
  };

  return (
    <div className="flex items-center justify-between gap-2 overflow-x-auto border-b border-terminal-border bg-terminal-panel/90 px-3 py-1.5 backdrop-blur">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <span className="ot-type-label-compact hidden text-terminal-muted sm:inline md:inline">Workspace preset</span>
        <WorkspacePresetTrigger preset={preset} onOpen={onOpenPresetSheet} />
        <div className="hidden flex-nowrap items-center gap-1 md:flex" role="group" aria-label="Workspace presets">
          {PRESET_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => applyPreset(option.id)}
              title={`Switch to ${option.label} workspace preset`}
              className={`rounded-sm border px-2 py-1 ot-type-label-compact ${
                preset === option.id
                  ? "border-terminal-accent bg-terminal-accent/10 text-terminal-accent"
                  : "border-terminal-border text-terminal-muted hover:text-terminal-text"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
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
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const { isInitializing, isAuthenticated } = useAuth();

  useKeyboardShortcuts();

  const hasRightRail = Boolean(rightRailContent) || Boolean(rightRailSections?.length);
  const mobileNavEnabled = showMobileBottomNav;
  const mobileContentPad = mobileNavEnabled
    ? "pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-0"
    : "";

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

  const applyPreset = (nextPreset: WorkspacePreset) => {
    setPreset(nextPreset);
    window.dispatchEvent(new CustomEvent("ot:preset-change", { detail: nextPreset }));
  };

  return (
    <TerminalShellContext.Provider value={shellCtx}>
      <div className="ot-app-shell flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-terminal-bg text-terminal-text">
        <IconRail />

        <div className="relative z-10 flex min-w-0 flex-1 flex-col">
          <OfflineBanner />

          {/* Phone compact header — replaces stacked desktop chrome below md */}
          {mobileNavEnabled ? (
            <MobileHeader
              onSearchOpen={() => {
                setMobileMoreOpen(false);
                setMobileSearchOpen(true);
              }}
              onMoreOpen={() => {
                setMobileSearchOpen(false);
                setMobileMoreOpen(true);
              }}
            />
          ) : null}

          {/* Desktop command bar / tape / top bar — hidden on phone when mobile nav is active */}
          <div className={mobileNavEnabled ? "hidden md:contents" : "contents"}>
            <CommandBar
              onExecute={async (command) => {
                const parsed = parseCommand(command);
                return executeParsedCommand(parsed, navigate);
              }}
            />
            <TickerTape />
            <TopBar hideTickerLoader={hideTickerLoader} />
          </div>

          {showWorkspaceControls ? (
            <div className={mobileNavEnabled ? "hidden md:block" : undefined}>
              <WorkspaceControlBar
                preset={preset}
                setPreset={setPreset}
                rightRailEnabled={hasRightRail}
                rightRailOpen={rightRailOpen}
                toggleRightRail={() => setRightRailOpen(!rightRailOpen)}
                onOpenPresetSheet={() => setPresetSheetOpen(true)}
              />
            </div>
          ) : null}

          {/* Phone-only preset trigger when workspace controls are otherwise hidden on desktop chrome */}
          {showWorkspaceControls && mobileNavEnabled ? (
            <div className="flex items-center gap-2 border-b border-terminal-border bg-terminal-panel/80 px-2 py-1.5 md:hidden">
              <WorkspacePresetTrigger preset={preset} onOpen={() => setPresetSheetOpen(true)} />
              <span className="text-[12px] text-terminal-muted">Workspace preset</span>
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
            {hasRightRail && rightRailOpen
              ? rightRailContent ?? (
                  <DefaultRightRail title={rightRailTitle} sections={rightRailSections ?? []} />
                )
              : null}
          </div>
          <div className={mobileNavEnabled ? "hidden md:block" : undefined}>
            <StatusBar tickerOverride={statusBarTickerOverride} />
          </div>
        </div>

        <UpdateAvailableBanner />
        {showInstallPrompt ? <InstallPromptBanner /> : null}
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
          onSelect={applyPreset}
          onClose={() => setPresetSheetOpen(false)}
        />
        <div className="hidden md:contents">
          <HotKeyPanelFloat />
        </div>
        <CommandPalette />
        <HudOverlay />
        <AlertToasts />
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
