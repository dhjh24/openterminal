/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../agent/agentStore", () => ({
  useAgentStore: (sel: (s: { toggleOpen: () => void }) => unknown) =>
    sel({ toggleOpen: vi.fn() }),
}));

import { MobileBottomNav } from "../components/layout/MobileBottomNav";

describe("MobileBottomNav", () => {
  it("renders five primary tabs with labels", () => {
    render(
      <MemoryRouter>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("mobile-bottom-nav")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Watch" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Stocks" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Options" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "News" })).toBeNull();
  });

  it("opens More sheet with News, Alerts, Portfolio, Screener, Workstation, Settings, Agent", () => {
    render(
      <MemoryRouter>
        <MobileBottomNav />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("mobile-nav-more"));
    expect(screen.getByTestId("mobile-more-sheet")).toBeTruthy();
    for (const label of ["News", "Alerts", "Portfolio", "Screener", "Workstation", "Settings", "Agent"]) {
      expect(screen.getByRole("menuitem", { name: label })).toBeTruthy();
    }
  });
});
