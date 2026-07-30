import { createChart, LineSeries } from "lightweight-charts";
import { describe, expect, it } from "vitest";

/**
 * Documents the lightweight-charts contract that TradingChart cleanup must obey:
 * never call removeSeries after chart.remove() — it throws "Value is undefined".
 */
describe("TradingChart cleanup removeSeries contract", () => {
  it("throws Value is undefined when removeSeries runs after chart.remove", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const chart = createChart(el, { width: 600, height: 400 });
    const series = chart.addSeries(LineSeries, { color: "#4EA1FF" });
    series.setData([
      { time: 1 as never, value: 10 },
      { time: 2 as never, value: 12 },
    ]);

    chart.remove();

    expect(() => chart.removeSeries(series)).toThrow(/undefined/i);
  });

  it("does not throw when refs are cleared before chart.remove", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const chart = createChart(el, { width: 600, height: 400 });
    const comparisonSeries: Array<ReturnType<typeof chart.addSeries>> = [];
    const line = chart.addSeries(LineSeries, { color: "#4EA1FF" });
    line.setData([
      { time: 1 as never, value: 10 },
      { time: 2 as never, value: 12 },
    ]);
    comparisonSeries.push(line);

    comparisonSeries.length = 0;
    expect(() => chart.remove()).not.toThrow();
  });
});
