/** @vitest-environment jsdom */
import { render } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChart } from "lightweight-charts";

import {
  safeDestroyChart,
  safeRemoveSeries,
  type AnySeries,
} from "../shared/chart/safeChartCleanup";

const callOrder: string[] = [];

vi.mock("lightweight-charts", () => ({
  createChart: vi.fn(),
}));

function ChartCleanupHarness() {
  useEffect(() => {
    const mainSeries = { id: "main" } as AnySeries;
    const comparisonSeries = { id: "comparison" } as AnySeries;

    const chart = {
      addSeries: vi.fn().mockReturnValueOnce(mainSeries).mockReturnValueOnce(comparisonSeries),
      removeSeries: vi.fn((series: AnySeries) => {
        callOrder.push(`removeSeries:${(series as { id: string }).id}`);
      }),
      remove: vi.fn(() => {
        callOrder.push("chart.remove");
        chart.removeSeries.mockImplementation(() => {
          throw new Error("Value is undefined");
        });
      }),
    };

    vi.mocked(createChart).mockReturnValue(chart as never);
    createChart(document.createElement("div"));
    chart.addSeries();
    chart.addSeries();

    return () => {
      safeRemoveSeries(chart as never, comparisonSeries);
      safeRemoveSeries(chart as never, mainSeries);
      safeDestroyChart(chart as never);
    };
  }, []);

  return null;
}

describe("chart cleanup order", () => {
  beforeEach(() => {
    callOrder.length = 0;
    vi.mocked(createChart).mockReset();
  });

  it("removes series before chart.remove and never after", () => {
    const { unmount } = render(<ChartCleanupHarness />);
    unmount();

    expect(callOrder).toEqual(["removeSeries:comparison", "removeSeries:main", "chart.remove"]);
    const removeIndex = callOrder.indexOf("chart.remove");
    const afterRemove = callOrder.slice(removeIndex + 1);
    expect(afterRemove.filter((entry) => entry.startsWith("removeSeries:"))).toEqual([]);
  });

  it("handles Strict Mode double cleanup without throwing", () => {
    const { unmount } = render(
      <StrictMode>
        <ChartCleanupHarness />
      </StrictMode>,
    );

    expect(() => unmount()).not.toThrow();
  });
});
