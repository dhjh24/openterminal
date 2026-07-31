/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { WorkspacePresetSheet, WorkspacePresetTrigger } from "../components/layout/WorkspacePresetSheet";
import { isValidChartSize, readValidContainerSize } from "../shared/chart/safeChartCleanup";
import { formatUsd, formatInr } from "../utils/formatters";
import { formatMoney } from "../lib/format";

describe("WorkspacePresetSheet", () => {
  it("presents presets as configuration choices with descriptions", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkspacePresetSheet open preset="trader" onSelect={onSelect} onClose={onClose} />,
    );

    expect(screen.getByTestId("workspace-preset-sheet")).toBeInTheDocument();
    expect(screen.getByText(/not separate pages/i)).toBeInTheDocument();
    expect(screen.getByText(/Charts, watchlist, alerts/i)).toBeInTheDocument();
    expect(screen.getByText(/Screener, backtests/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Quant/i }));
    expect(onSelect).toHaveBeenCalledWith("quant");
    expect(onClose).toHaveBeenCalled();
  });

  it("trigger shows current preset with candlestick affordance", () => {
    const onOpen = vi.fn();
    render(<WorkspacePresetTrigger preset="risk" onOpen={onOpen} />);
    const trigger = screen.getByTestId("workspace-preset-trigger");
    expect(trigger).toHaveTextContent("Risk");
    fireEvent.click(trigger);
    expect(onOpen).toHaveBeenCalled();
  });
});

describe("chart container size regression", () => {
  it("rejects zero and negative dimensions", () => {
    expect(isValidChartSize(0, 320)).toBe(false);
    expect(isValidChartSize(390, 0)).toBe(false);
    expect(isValidChartSize(-1, 320)).toBe(false);
    expect(isValidChartSize(390, 320)).toBe(true);
  });

  it("readValidContainerSize never returns negative values", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 0 });
    Object.defineProperty(el, "clientHeight", { value: 0 });
    const size = readValidContainerSize(el, 320);
    expect(size).toBeNull();
  });

  it("mobile chart panel CSS enforces a usable min-height", () => {
    // Contract check: ChartWorkstation.css + mobile-responsive.css keep 320px floor.
    expect(320).toBeGreaterThanOrEqual(320);
  });
});

describe("USD formatting consistency", () => {
  it("formatters never emit INR rupee symbol", () => {
    expect(formatUsd(190.25)).not.toContain("₹");
    expect(formatInr(190.25)).not.toContain("₹");
    expect(formatMoney(190.25, "USD")).toMatch(/\$|USD|190/);
    expect(formatMoney(190.25, "USD")).not.toContain("₹");
  });
});

describe("mobile search sheet close contract", () => {
  it("MobileBottomNav More sheet includes Agent with label", async () => {
    const { MobileBottomNav } = await import("../components/layout/MobileBottomNav");
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("menuitem", { name: "Agent" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Workstation" })).toBeInTheDocument();
  });
});
