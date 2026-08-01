import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HubLandingView } from "../pages/hubs/HubLandingPage";
import { getHubLandingConfig, HUB_LANDING_CONFIGS } from "../home/hubLandings";
import { DESKTOP_HUBS, isDesktopHubActive } from "../home/mobileNav";

describe("hub landings", () => {
  it("defines landing paths for Markets Trade Research Portfolio", () => {
    expect(HUB_LANDING_CONFIGS.markets.path).toBe("/equity/markets");
    expect(HUB_LANDING_CONFIGS.trade.path).toBe("/equity/trade");
    expect(HUB_LANDING_CONFIGS.research.path).toBe("/equity/research-desk");
    expect(HUB_LANDING_CONFIGS.portfolio.path).toBe("/equity/portfolio-desk");
    expect(DESKTOP_HUBS.find((hub) => hub.id === "markets")?.path).toBe("/equity/markets");
    expect(DESKTOP_HUBS.find((hub) => hub.id === "research")?.path).toBe("/equity/research-desk");
  });

  it("keeps hub active on landing and nested leaf routes", () => {
    expect(isDesktopHubActive("markets", "/equity/markets")).toBe(true);
    expect(isDesktopHubActive("markets", "/equity/stocks")).toBe(true);
    expect(isDesktopHubActive("trade", "/equity/trade")).toBe(true);
    expect(isDesktopHubActive("trade", "/equity/chart-workstation")).toBe(true);
    expect(isDesktopHubActive("research", "/equity/research-desk")).toBe(true);
    expect(isDesktopHubActive("research", "/equity/screener")).toBe(true);
    expect(isDesktopHubActive("research", "/equity/research")).toBe(true);
    expect(isDesktopHubActive("portfolio", "/equity/portfolio-desk")).toBe(true);
    expect(isDesktopHubActive("portfolio", "/equity/portfolio")).toBe(true);
  });

  it("renders Markets hub tools and primary CTA", () => {
    const onNavigate = vi.fn();
    render(<HubLandingView config={getHubLandingConfig("markets")} onNavigate={onNavigate} />);

    expect(screen.getByTestId("hub-landing-markets")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Markets" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("hub-primary-markets"));
    expect(onNavigate).toHaveBeenCalledWith("/equity/stocks");
    fireEvent.click(screen.getByRole("button", { name: /Heatmap\. Market breadth heatmap/i }));
    expect(onNavigate).toHaveBeenCalledWith("/equity/heatmap");
  });
});
