import type { IChartApi, IPriceLine, ISeriesApi, SeriesType } from "lightweight-charts";

export type AnySeries = ISeriesApi<SeriesType>;

/**
 * Safe series removal: no-ops when chart/series are already gone.
 * Does not swallow unexpected errors from a live chart.
 */
export function safeRemoveSeries(chart: IChartApi | null | undefined, series: AnySeries | null | undefined): boolean {
  if (!chart || !series) return false;
  try {
    chart.removeSeries(series);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    // Lightweight Charts throws "Value is undefined" when the chart/series was already destroyed.
    if (/undefined|destroyed|disposed|already/i.test(message)) {
      return false;
    }
    throw error;
  }
}

export function safeRemovePriceLine(
  series: { removePriceLine?: (line: IPriceLine) => void } | null | undefined,
  line: IPriceLine | null | undefined,
): boolean {
  if (!series?.removePriceLine || !line) return false;
  try {
    series.removePriceLine(line);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (/undefined|destroyed|disposed|already/i.test(message)) {
      return false;
    }
    throw error;
  }
}

export function safeRemoveAllSeries(
  chart: IChartApi | null | undefined,
  seriesList: Iterable<AnySeries | null | undefined>,
): void {
  for (const series of seriesList) {
    safeRemoveSeries(chart, series);
  }
}

/**
 * Destroy a chart exactly once. Callers must clear owned series refs first
 * (or accept that chart.remove() tears them down without removeSeries).
 */
export function safeDestroyChart(chart: IChartApi | null | undefined): boolean {
  if (!chart) return false;
  try {
    chart.remove();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (/undefined|destroyed|disposed|already/i.test(message)) {
      return false;
    }
    throw error;
  }
}

export function isValidChartSize(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width >= 1 && height >= 1;
}

export function readValidContainerSize(
  el: HTMLElement | null | undefined,
  fallbackHeight = 520,
): { width: number; height: number } | null {
  if (!el) return null;
  const width = el.clientWidth;
  const height = el.clientHeight || fallbackHeight;
  if (!isValidChartSize(width, height)) return null;
  return { width, height };
}
