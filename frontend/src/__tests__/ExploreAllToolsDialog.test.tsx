import type { ReactNode } from "react";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionQueueSection } from "../components/home/ActionQueueSection";
import { ExploreAllToolsDialog } from "../components/home/ExploreAllToolsDialog";

vi.mock("../components/layout/MobileBottomSheet", () => ({
  MobileBottomSheet: ({
    open,
    children,
    title,
    testId,
  }: {
    open: boolean;
    children: ReactNode;
    title: string;
    testId?: string;
  }) =>
    open ? (
      <div data-testid={testId || "mobile-bottom-sheet"} role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

describe("ActionQueueSection", () => {
  it("renders empty guidance and explore action", () => {
    const onExplore = vi.fn();
    render(<ActionQueueSection items={[]} onSelect={vi.fn()} onExplore={onExplore} />);
    expect(screen.getByTestId("action-queue")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Explore all tools/i }));
    expect(onExplore).toHaveBeenCalled();
  });

  it("invokes onSelect for queue items", () => {
    const onSelect = vi.fn();
    render(
      <ActionQueueSection
        items={[
          {
            id: "open-alerts",
            title: "2 open alerts",
            description: "Review alerts",
            severity: "warning",
            actionLabel: "Open Alerts",
            to: "/equity/alerts",
          },
        ]}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Open Alerts/i }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "open-alerts" }));
  });
});

describe("ExploreAllToolsDialog", () => {
  it("renders categorized tools and closes", () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <ExploreAllToolsDialog
        open
        onClose={onClose}
        forceMobile
        sections={[
          {
            id: "markets",
            title: "MARKETS",
            items: [
              {
                id: "equity",
                label: "Equity",
                shortcut: "M1",
                description: "Quotes, movers, and market overview",
                onSelect,
              },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByTestId("explore-all-tools-body")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Equity\. Quotes, movers, and market overview/i }));
    expect(onSelect).toHaveBeenCalled();
  });
});
