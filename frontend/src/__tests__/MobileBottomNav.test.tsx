/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toggleOpenMock = vi.fn();

vi.mock("../agent/agentStore", () => ({
  useAgentStore: (selector: (state: { toggleOpen: () => void }) => unknown) =>
    selector({ toggleOpen: toggleOpenMock }),
}));

import { MobileBottomNav } from "../components/layout/MobileBottomNav";

describe("MobileBottomNav", () => {
  beforeEach(() => {
    toggleOpenMock.mockReset();
  });

  it("renders primary tab labels", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/home"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Watch")).toBeInTheDocument();
    expect(screen.getByText("Stocks")).toBeInTheDocument();
    expect(screen.getByText("Options")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-bottom-nav")).toBeInTheDocument();
  });

  it("opens More sheet with secondary destinations and Agent", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/home"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(screen.getByTestId("mobile-more-sheet")).toBeInTheDocument();
    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
    expect(screen.getByText("Screener")).toBeInTheDocument();
    expect(screen.getByText("Workstation")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
  });

  it("opens Agent console from More sheet", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/home"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Agent" }));

    expect(toggleOpenMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("mobile-more-sheet")).not.toBeInTheDocument();
  });
});
