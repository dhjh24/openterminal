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
import { isMobileHubActive, isMoreDestinationActive } from "../home/mobileNav";

describe("mobile hub matching", () => {
  it("keeps Markets active on nested market routes", () => {
    expect(isMobileHubActive("markets", "/equity/stocks/AAPL")).toBe(true);
    expect(isMobileHubActive("markets", "/fno/greeks")).toBe(true);
    expect(isMobileHubActive("trade", "/equity/chart-workstation")).toBe(true);
    expect(isMobileHubActive("trade", "/equity/watchlist")).toBe(true);
    expect(isMobileHubActive("portfolio", "/equity/risk")).toBe(true);
    expect(isMobileHubActive("home", "/home")).toBe(true);
  });

  it("marks More destinations when not inside a primary hub", () => {
    expect(isMoreDestinationActive("/equity/screener")).toBe(true);
    expect(isMoreDestinationActive("/equity/settings")).toBe(true);
    expect(isMoreDestinationActive("/equity/watchlist")).toBe(false);
    expect(isMoreDestinationActive("/fno")).toBe(false);
  });
});

describe("MobileBottomNav", () => {
  beforeEach(() => {
    toggleOpenMock.mockReset();
  });

  it("renders Home Markets Trade Portfolio More hubs", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/home"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("mobile-hub-home")).toHaveTextContent("Home");
    expect(screen.getByTestId("mobile-hub-markets")).toHaveTextContent("Markets");
    expect(screen.getByTestId("mobile-hub-trade")).toHaveTextContent("Trade");
    expect(screen.getByTestId("mobile-hub-portfolio")).toHaveTextContent("Portfolio");
    expect(screen.getByTestId("mobile-hub-more")).toHaveTextContent("More");
    expect(screen.getByTestId("mobile-bottom-nav")).toBeInTheDocument();
  });

  it("highlights Trade hub on nested chart route", () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={["/equity/chart-workstation"]}
      >
        <MobileBottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("mobile-hub-trade")).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("mobile-hub-home")).toHaveAttribute("data-active", "false");
  });

  it("opens grouped More sheet with Agent and Escape close", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/home"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByTestId("mobile-more-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-more-sections")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Research" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alerts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tools" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Open Agent" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Screener" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("mobile-more-sheet")).not.toBeInTheDocument();
  });

  it("opens Agent console from More sheet", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/home"]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Open Agent" }));

    expect(toggleOpenMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("mobile-more-sheet")).not.toBeInTheDocument();
  });
});
