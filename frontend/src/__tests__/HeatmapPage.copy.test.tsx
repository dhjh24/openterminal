/** @vitest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { HeatmapPage } from "../fno/pages/HeatmapPage";

vi.mock("../fno/api/fnoApi", () => ({
  fetchHeatmapOI: vi.fn(async () => [
    {
      symbol: "NIFTY",
      pe_oi_total: 1200000,
      ce_oi_total: 900000,
      pcr_oi: 1.33,
    },
    {
      symbol: "BANKNIFTY",
      pe_oi_total: 800000,
      ce_oi_total: 700000,
      pcr_oi: 1.14,
    },
  ]),
  fetchHeatmapIV: vi.fn(async () => [
    { symbol: "NIFTY", atm_iv: 14.2, iv_rank: 62 },
    { symbol: "BANKNIFTY", atm_iv: 18.5, iv_rank: 71 },
  ]),
}));

function renderHeatmapPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HeatmapPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HeatmapPage copy", () => {
  it("does not surface Kite branding when heatmap data loads", async () => {
    renderHeatmapPage();

    expect(await screen.findByText("NIFTY")).toBeInTheDocument();
    expect(screen.queryByText(/Kite/i)).not.toBeInTheDocument();
    expect(document.body.textContent?.match(/Kite/i)).toBeNull();
  });

  it("uses US provider guidance on empty and error states", async () => {
    const { fetchHeatmapOI } = await import("../fno/api/fnoApi");
    vi.mocked(fetchHeatmapOI).mockResolvedValueOnce([]);
    renderHeatmapPage();
    expect(await screen.findByText(/US option chains/i)).toBeInTheDocument();
    expect(screen.queryByText(/Kite/i)).not.toBeInTheDocument();
  });
});
