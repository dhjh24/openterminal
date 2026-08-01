/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspacePresetSheet, WorkspacePresetTrigger } from "../components/layout/WorkspacePresetSheet";
import { WorkspacePresetSelector } from "../components/layout/WorkspacePresetSelector";
import { WorkspaceOnboardingDialog } from "../components/layout/WorkspaceOnboardingDialog";
import {
  announceWorkspacePresetChange,
  getWorkspacePresetConfig,
  readWorkspacePreset,
  writeWorkspacePreset,
  WORKSPACE_PRESET_STORAGE_KEY,
} from "../workspace/presets";

describe("WorkspacePresetSheet", () => {
  it("shows workspace purpose, pinned tools, and apply actions", () => {
    render(
      <WorkspacePresetSheet
        open
        preset="quant"
        onApply={vi.fn()}
        onApplyAndOpen={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Workspace switcher")).toBeInTheDocument();
    expect(
      screen.getByText(/Workspaces change pinned tools, Mission Control sections/i),
    ).toBeInTheDocument();

    expect(screen.getByText("Trader workspace")).toBeInTheDocument();
    expect(
      screen.getByText("Active trading desk for charts, watchlist, alerts, and paper execution."),
    ).toBeInTheDocument();

    expect(screen.getByText("Quant workspace")).toBeInTheDocument();
    expect(screen.getByText(/Lands on Quant Research/i)).toBeInTheDocument();
    expect(screen.getByTestId("workspace-apply-quant")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-apply-open-quant")).toHaveTextContent(/Apply and open Quant Research/i);
  });

  it("Apply calls onApply and onClose", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    render(
      <WorkspacePresetSheet
        open
        preset="quant"
        onApply={onApply}
        onApplyAndOpen={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTestId("workspace-apply-trader"));

    expect(onApply).toHaveBeenCalledWith("trader");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Apply and open calls onApplyAndOpen", () => {
    const onApplyAndOpen = vi.fn();
    const onClose = vi.fn();

    render(
      <WorkspacePresetSheet
        open
        preset="trader"
        onApply={vi.fn()}
        onApplyAndOpen={onApplyAndOpen}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTestId("workspace-apply-open-quant"));
    expect(onApplyAndOpen).toHaveBeenCalledWith("quant");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("WorkspacePresetSelector", () => {
  it("desktop switcher replaces the five-button row with one control", () => {
    render(
      <WorkspacePresetSelector
        variant="desktop"
        preset="trader"
        onApply={vi.fn()}
        onApplyAndOpen={vi.fn()}
      />,
    );

    expect(screen.getByTestId("workspace-preset-selector")).toHaveTextContent("Trader workspace");
    fireEvent.click(screen.getByTestId("workspace-preset-selector"));
    expect(screen.getByTestId("workspace-preset-panel")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-card-quant")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-card-pm")).toHaveTextContent(/Portfolio workspace/i);
    expect(screen.getByTestId("workspace-card-ops")).toHaveTextContent(/Operations workspace/i);
    expect(screen.getByTestId("workspace-apply-open-quant")).toHaveTextContent("Apply and open Quant Research");
  });
});

describe("WorkspaceOnboardingDialog", () => {
  it("maps first-use choices to presets and supports skip", () => {
    const onSelect = vi.fn();
    const onSkip = vi.fn();
    render(<WorkspaceOnboardingDialog open onSelect={onSelect} onSkip={onSkip} />);

    expect(screen.getByText(/What do you mainly use OpenTerminal for/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("workspace-onboarding-research"));
    expect(onSelect).toHaveBeenCalledWith("quant");

    fireEvent.click(screen.getByTestId("workspace-onboarding-skip"));
    expect(onSkip).toHaveBeenCalled();
  });
});

describe("workspace preset storage helpers", () => {
  it("reads JSON and legacy raw preset values", () => {
    localStorage.setItem(WORKSPACE_PRESET_STORAGE_KEY, JSON.stringify("risk"));
    expect(readWorkspacePreset()).toBe("risk");
    localStorage.setItem(WORKSPACE_PRESET_STORAGE_KEY, "ops");
    expect(readWorkspacePreset()).toBe("ops");
  });

  it("writes JSON and announces changes", () => {
    const toast = vi.fn();
    const change = vi.fn();
    window.addEventListener("ot:alert-toast", toast as EventListener);
    window.addEventListener("ot:preset-change", change as EventListener);

    writeWorkspacePreset("pm");
    expect(JSON.parse(localStorage.getItem(WORKSPACE_PRESET_STORAGE_KEY) || "")).toBe("pm");
    expect(getWorkspacePresetConfig("quant").landing.primaryLabel).toBe("Run Backtest");

    announceWorkspacePresetChange("quant");
    expect(toast).toHaveBeenCalled();
    expect(change).toHaveBeenCalled();

    window.removeEventListener("ot:alert-toast", toast as EventListener);
    window.removeEventListener("ot:preset-change", change as EventListener);
  });
});

describe("WorkspacePresetTrigger", () => {
  it("shows current workspace with open affordance", () => {
    const onOpen = vi.fn();
    render(<WorkspacePresetTrigger preset="risk" onOpen={onOpen} />);
    const trigger = screen.getByTestId("workspace-preset-trigger");
    expect(trigger).toHaveTextContent("Risk workspace");
    fireEvent.click(trigger);
    expect(onOpen).toHaveBeenCalled();
  });
});
