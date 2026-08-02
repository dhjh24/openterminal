import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OptionChainTable } from "../fno/components/OptionChainTable";
import type { StrikeData } from "../fno/types/fno";

const placePaperOrderMock = vi.fn();
const fetchPaperPortfoliosMock = vi.fn();
const createPaperPortfolioMock = vi.fn();
const fetchPaperPositionsMock = vi.fn();

vi.mock("../hooks/useDisplayCurrency", () => ({
  useDisplayCurrency: () => ({
    formatDisplayMoney: (value: number) => `$${Number(value).toFixed(2)}`,
  }),
}));

vi.mock("../api/client", () => ({
  placePaperOrder: (...args: unknown[]) => placePaperOrderMock(...args),
  fetchPaperPortfolios: (...args: unknown[]) => fetchPaperPortfoliosMock(...args),
  createPaperPortfolio: (...args: unknown[]) => createPaperPortfolioMock(...args),
  fetchPaperPositions: (...args: unknown[]) => fetchPaperPositionsMock(...args),
}));

const rows: StrikeData[] = [
  {
    strike_price: 150,
    ce: {
      oi: 1000,
      oi_change: 10,
      volume: 200,
      iv: 22,
      ltp: 3.2,
      bid: 3.1,
      ask: 3.3,
      greeks: { delta: 0.45, gamma: 0.02, theta: -0.05, vega: 0.1, rho: 0.01 },
      contract_symbol: "AAPL250815C00150000",
    },
    pe: {
      oi: 900,
      oi_change: -5,
      volume: 180,
      iv: 24,
      ltp: 2.8,
      bid: 2.7,
      ask: 2.9,
      greeks: { delta: -0.4, gamma: 0.02, theta: -0.04, vega: 0.1, rho: -0.01 },
    },
  },
];

function renderTable() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <OptionChainTable rows={rows} atmStrike={150} underlying="AAPL" expiry="2025-08-15" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OptionChainTable paper flow (issue #27)", () => {
  beforeEach(() => {
    placePaperOrderMock.mockReset();
    fetchPaperPortfoliosMock.mockReset();
    createPaperPortfolioMock.mockReset();
    fetchPaperPositionsMock.mockReset();
    fetchPaperPortfoliosMock.mockResolvedValue([{ id: "pf-1", name: "Demo", initial_capital: 100000, current_cash: 100000 }]);
    placePaperOrderMock.mockResolvedValue({ id: "ord-1", status: "filled", symbol: "NASDAQ:AAPL250815C00150000" });
    fetchPaperPositionsMock.mockResolvedValue([]);
  });

  it("selects a call and previews a paper buy with estimated debit", async () => {
    renderTable();

    fireEvent.click(screen.getByTestId("option-select-CE-150"));

    expect(screen.getByTestId("paper-option-ticket")).toBeInTheDocument();
    expect(screen.getByTestId("paper-option-selected-label")).toHaveTextContent(/Call 150/i);
    expect(screen.getByTestId("paper-option-debit")).toHaveTextContent("$330.00");

    await waitFor(() => expect(fetchPaperPortfoliosMock).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId("paper-option-preview"));
    expect(screen.getByTestId("paper-option-preview-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("paper-option-confirm"));

    await waitFor(() => {
      expect(placePaperOrderMock).toHaveBeenCalled();
    });
    expect(placePaperOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolio_id: "pf-1",
        symbol: "NASDAQ:AAPL250815C00150000",
        side: "buy",
        order_type: "limit",
        quantity: 1,
        limit_price: 3.3,
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("paper-option-success")).toBeInTheDocument();
    });
  });

  it("exposes accessible selection state on the last price control", () => {
    renderTable();
    const btn = screen.getByTestId("option-select-CE-150");
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(btn.getAttribute("aria-label") || "").toMatch(/selected/i);
  });
});
