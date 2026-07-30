import { ColorType, type DeepPartial, type ChartOptions } from "lightweight-charts";

import type { ChartTextSize } from "../../store/settingsStore";
import { terminalColors } from "../../theme/terminal";

const CHART_AXIS_FALLBACK_PX: Record<ChartTextSize, number> = {
  sm: 12,
  md: 13,
  lg: 14,
};

/** Reads `--ot-chart-axis-size` from the document root (set by ThemeRuntime + terminal-theme.css). */
export function resolveChartAxisFontSize(chartTextSize: ChartTextSize = "md"): number {
  if (typeof document !== "undefined") {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--ot-chart-axis-size").trim();
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return CHART_AXIS_FALLBACK_PX[chartTextSize];
}

export const terminalChartTheme: DeepPartial<ChartOptions> = {
  layout: {
    background: { type: ColorType.Solid, color: terminalColors.panel },
    textColor: terminalColors.text,
    fontFamily: "Consolas, IBM Plex Mono, Lucida Console, monospace",
    panes: {
      enableResize: true,
      separatorColor: terminalColors.border,
      separatorHoverColor: terminalColors.accentAlt,
    },
  },
  grid: {
    vertLines: { color: terminalColors.border },
    horzLines: { color: terminalColors.border },
  },
  crosshair: {
    vertLine: { color: terminalColors.muted },
    horzLine: { color: terminalColors.muted },
  },
  rightPriceScale: {
    borderColor: terminalColors.border,
  },
  timeScale: {
    borderColor: terminalColors.border,
    timeVisible: true,
    secondsVisible: false,
  },
  handleScroll: {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: true,
  },
  handleScale: {
    axisPressedMouseMove: true,
    mouseWheel: true,
    pinch: true,
  },
};

export function chartThemeWithTextSize(chartTextSize: ChartTextSize = "md"): DeepPartial<ChartOptions> {
  const fontSize = resolveChartAxisFontSize(chartTextSize);
  return {
    ...terminalChartTheme,
    layout: {
      ...terminalChartTheme.layout,
      fontSize,
    },
  };
}
