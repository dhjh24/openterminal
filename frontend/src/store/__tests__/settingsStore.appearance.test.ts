/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("settingsStore appearance prefs", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("defaults appearance fields for new installs", async () => {
    const { useSettingsStore } = await import("../settingsStore");
    const state = useSettingsStore.getState();

    expect(state.uiDensity).toBe("comfortable");
    expect(state.contrastMode).toBe("standard");
    expect(state.dataFont).toBe("mono");
    expect(state.reducedMotion).toBe(false);
    expect(state.decorativeEffects).toBe(false);
    expect(state.chartTextSize).toBe("md");
  });

  it("migrates persisted partial state with safe defaults for new fields", async () => {
    localStorage.setItem(
      "ui-settings",
      JSON.stringify({
        state: {
          themeVariant: "terminal-noir",
          selectedMarket: "NASDAQ",
        },
        version: 0,
      }),
    );

    const { useSettingsStore } = await import("../settingsStore");
    const state = useSettingsStore.getState();

    expect(state.uiDensity).toBe("comfortable");
    expect(state.decorativeEffects).toBe(false);
    expect(state.chartTextSize).toBe("md");
  });

  it("persists appearance updates", async () => {
    const { useSettingsStore } = await import("../settingsStore");

    useSettingsStore.getState().setUiDensity("compact");
    useSettingsStore.getState().setContrastMode("high");
    useSettingsStore.getState().setDecorativeEffects(true);
    useSettingsStore.getState().setChartTextSize("lg");

    const persisted = JSON.parse(localStorage.getItem("ui-settings") || "{}") as {
      state?: {
        uiDensity?: string;
        contrastMode?: string;
        decorativeEffects?: boolean;
        chartTextSize?: string;
      };
    };

    expect(persisted.state?.uiDensity).toBe("compact");
    expect(persisted.state?.contrastMode).toBe("high");
    expect(persisted.state?.decorativeEffects).toBe(true);
    expect(persisted.state?.chartTextSize).toBe("lg");
  });
});
