import { TerminalBackground } from "../TerminalBackground";
import { useSettingsStore } from "../../store/settingsStore";

export function DecorativeEffects() {
  const decorativeEffects = useSettingsStore((s) => s.decorativeEffects);

  if (!decorativeEffects) return null;

  return (
    <>
      <TerminalBackground />
      <div className="ot-vignette-overlay" aria-hidden="true" />
      <div className="ot-scanline-overlay" aria-hidden="true" />
    </>
  );
}
