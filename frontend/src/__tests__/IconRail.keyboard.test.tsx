import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigateSpy = vi.fn();
const toggleOpenMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock("../agent/agentStore", () => ({
  useAgentStore: (selector: (state: { toggleOpen: () => void }) => unknown) =>
    selector({ toggleOpen: toggleOpenMock }),
}));

import { IconRail } from "../components/layout/IconRail";
import { DESKTOP_HUBS, isDesktopHubActive, isDesktopMoreDestinationActive } from "../home/mobileNav";

describe("desktop hub matching", () => {
  it("exposes five product hubs", () => {
    expect(DESKTOP_HUBS.map((hub) => hub.id)).toEqual(["home", "markets", "trade", "research", "portfolio"]);
  });

  it("keeps Research active on screener and backtesting routes", () => {
    expect(isDesktopHubActive("research", "/equity/screener")).toBe(true);
    expect(isDesktopHubActive("research", "/backtesting/model-lab")).toBe(true);
    expect(isDesktopHubActive("trade", "/equity/chart-workstation")).toBe(true);
    expect(isDesktopMoreDestinationActive("/equity/screener")).toBe(false);
    expect(isDesktopMoreDestinationActive("/equity/settings")).toBe(true);
    expect(isDesktopMoreDestinationActive("/equity/data-quality")).toBe(true);
  });
});

describe("IconRail keyboard and hubs", () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    toggleOpenMock.mockReset();
  });

  it("renders five hubs plus More and moves focus with arrows", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/home"]}>
        <IconRail />
      </MemoryRouter>,
    );

    const rail = screen.getByLabelText("Primary navigation");
    expect(screen.getByTestId("icon-rail-home")).toBeInTheDocument();
    expect(screen.getByTestId("icon-rail-markets")).toBeInTheDocument();
    expect(screen.getByTestId("icon-rail-trade")).toBeInTheDocument();
    expect(screen.getByTestId("icon-rail-research")).toBeInTheDocument();
    expect(screen.getByTestId("icon-rail-portfolio")).toBeInTheDocument();
    expect(screen.getByTestId("icon-rail-more")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-rail-settings")).not.toBeInTheDocument();

    const home = screen.getByLabelText(/Home\. Mission Control dashboard/i);
    const markets = screen.getByLabelText(/Markets\. Stocks, derivatives/i);
    home.focus();
    fireEvent.keyDown(rail, { key: "ArrowDown" });
    expect(document.activeElement).toBe(markets);

    fireEvent.keyDown(rail, { key: "Enter" });
    expect(navigateSpy).toHaveBeenCalledWith("/equity/stocks");
  });

  it("opens More panel with Settings & Admin links", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/home"]}>
        <IconRail />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("icon-rail-more"));
    expect(screen.getByTestId("icon-rail-more-panel")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings & Admin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Data quality" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Order management" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("icon-rail-more-panel")).not.toBeInTheDocument();
  });
});
