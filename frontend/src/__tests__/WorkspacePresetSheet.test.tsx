/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspacePresetSheet } from "../components/layout/WorkspacePresetSheet";

describe("WorkspacePresetSheet", () => {
  it("shows preset copy and all five presets with descriptions", () => {
    render(
      <WorkspacePresetSheet open preset="quant" onSelect={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByText("Workspace preset")).toBeInTheDocument();
    expect(
      screen.getByText("Presets change layout and quick links. They are not separate pages."),
    ).toBeInTheDocument();

    expect(screen.getByText("Trader")).toBeInTheDocument();
    expect(
      screen.getByText("Charts, watchlist, alerts, and execution paths for active trading."),
    ).toBeInTheDocument();

    expect(screen.getByText("Quant")).toBeInTheDocument();
    expect(
      screen.getByText("Screener, backtests, and research panels for systematic work."),
    ).toBeInTheDocument();

    expect(screen.getByText("PM")).toBeInTheDocument();
    expect(
      screen.getByText("Portfolio, risk, and allocation views for portfolio management."),
    ).toBeInTheDocument();

    expect(screen.getByText("Risk")).toBeInTheDocument();
    expect(
      screen.getByText("Risk dashboards, exposure, and compliance-oriented monitors."),
    ).toBeInTheDocument();

    expect(screen.getByText("Ops")).toBeInTheDocument();
    expect(
      screen.getByText("Ops health, feeds, and platform controls for desk operations."),
    ).toBeInTheDocument();
  });

  it("selecting Trader calls onSelect and onClose", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <WorkspacePresetSheet open preset="quant" onSelect={onSelect} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Trader/i }));

    expect(onSelect).toHaveBeenCalledWith("trader");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
