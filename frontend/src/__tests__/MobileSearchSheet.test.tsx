/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const searchSymbolsMock = vi.fn();

vi.mock("../api/client", () => ({
  searchSymbols: (...args: unknown[]) => searchSymbolsMock(...args),
}));

import { MobileSearchSheet } from "../components/layout/MobileSearchSheet";
import { useSettingsStore } from "../store/settingsStore";
import { useStockStore } from "../store/stockStore";

describe("MobileSearchSheet", () => {
  beforeEach(() => {
    searchSymbolsMock.mockReset();
    searchSymbolsMock.mockResolvedValue([]);

    useSettingsStore.setState({
      selectedMarket: "NASDAQ",
      recentSecurities: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          assetClass: "equity",
          market: "US",
          visitedAt: 1,
        },
      ],
    } as Partial<ReturnType<typeof useSettingsStore.getState>> as never);

    useStockStore.setState({
      ticker: "AAPL",
      setTicker: vi.fn(),
      load: vi.fn(async () => undefined),
    } as Partial<ReturnType<typeof useStockStore.getState>> as never);
  });

  it("shows search input with mobile typography and no desktop shortcut hints", () => {
    const onClose = vi.fn();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/home"]}>
        <MobileSearchSheet open onClose={onClose} />
      </MemoryRouter>,
    );

    const sheet = screen.getByTestId("mobile-search-sheet");
    expect(sheet).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Search symbols, pages, and commands");
    expect(input).toHaveClass("text-base");
    expect(screen.queryByText(/Ctrl\+/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("lists recent securities when query is empty", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/home"]}>
        <MobileSearchSheet open onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Recent searches")).toBeInTheDocument();
    expect(screen.getByText("AAPL")).toBeInTheDocument();
  });

  it("calls searchSymbols when typing", async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/home"]}>
        <MobileSearchSheet open onClose={vi.fn()} />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("Search symbols, pages, and commands"), { target: { value: "msft" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(searchSymbolsMock).toHaveBeenCalledWith("msft", "NASDAQ");

    vi.useRealTimers();
  });
});
