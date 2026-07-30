import { useEffect } from "react";

import { useSettingsStore } from "../../store/settingsStore";

export function ThemeRuntime() {
  const themeVariant = useSettingsStore((s) => s.themeVariant);
  const customAccentColor = useSettingsStore((s) => s.customAccentColor);
  const uiDensity = useSettingsStore((s) => s.uiDensity);
  const contrastMode = useSettingsStore((s) => s.contrastMode);
  const dataFont = useSettingsStore((s) => s.dataFont);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const decorativeEffects = useSettingsStore((s) => s.decorativeEffects);
  const chartTextSize = useSettingsStore((s) => s.chartTextSize);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-ot-theme", themeVariant);
    root.style.setProperty("--ot-custom-accent", customAccentColor);
    root.setAttribute("data-ot-density", uiDensity);
    root.setAttribute("data-ot-contrast", contrastMode);
    root.setAttribute("data-ot-data-font", dataFont);
    root.setAttribute("data-ot-effects", decorativeEffects ? "on" : "off");
    root.setAttribute("data-ot-chart-text", chartTextSize);
    if (themeVariant === "light-desk") {
      root.style.setProperty("color-scheme", "light");
    } else {
      root.style.setProperty("color-scheme", "dark");
    }
  }, [
    themeVariant,
    customAccentColor,
    uiDensity,
    contrastMode,
    dataFont,
    reducedMotion,
    decorativeEffects,
    chartTextSize,
  ]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const root = document.documentElement;
      const userPref = useSettingsStore.getState().reducedMotion;
      const effective = userPref || media.matches;
      root.setAttribute("data-ot-reduced-motion", effective ? "true" : "false");
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [reducedMotion]);

  return null;
}
