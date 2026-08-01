import { describe, expect, it } from "vitest";

import {
  isFocusDefaultRoute,
  resolveShellChromeMode,
  shellChromeVisibility,
} from "../home/shellChrome";

describe("shellChrome", () => {
  it("marks chart, tape, DOM, and options routes as focus defaults", () => {
    expect(isFocusDefaultRoute("/equity/chart-workstation")).toBe(true);
    expect(isFocusDefaultRoute("/equity/tape")).toBe(true);
    expect(isFocusDefaultRoute("/equity/dom")).toBe(true);
    expect(isFocusDefaultRoute("/fno/greeks")).toBe(true);
    expect(isFocusDefaultRoute("/home")).toBe(false);
  });

  it("auto-upgrades Standard to Focus on dense laptop pages", () => {
    expect(resolveShellChromeMode("standard", "/equity/chart-workstation", 1366)).toBe("focus");
    expect(resolveShellChromeMode("standard", "/home", 1366)).toBe("standard");
    expect(resolveShellChromeMode("full", "/equity/chart-workstation", 1366)).toBe("full");
    expect(resolveShellChromeMode("focus", "/home", 1440)).toBe("focus");
    expect(resolveShellChromeMode("standard", "/equity/chart-workstation", 1440)).toBe("standard");
  });

  it("hides tape, workspace, and context rail in Focus", () => {
    const focus = shellChromeVisibility("focus");
    expect(focus.tickerTape).toBe(false);
    expect(focus.workspaceControls).toBe(false);
    expect(focus.contextRail).toBe(false);
    expect(focus.topBar).toBe(true);
    expect(focus.statusBar).toBe(true);

    const full = shellChromeVisibility("full");
    expect(full.tickerTape).toBe(true);
    expect(full.contextRail).toBe(true);
    expect(full.workspaceControls).toBe(true);
  });
});
