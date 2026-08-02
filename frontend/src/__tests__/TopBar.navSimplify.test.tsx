import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TopBar } from "../components/layout/TopBar";

const loginMock = vi.fn();

vi.mock("../hooks/useStocks", () => ({
  useMarketStatus: () => ({ data: null }),
  useTopBarTickers: () => ({ data: null }),
}));

vi.mock("../hooks/useNavigationHistory", () => ({
  useNavigationHistory: () => ({ breadcrumbs: [{ label: "Home", path: "/home" }] }),
}));

vi.mock("../hooks/useRecentSecurities", () => ({
  useRecentSecurities: () => ({ addRecent: vi.fn() }),
  inferRecentSecurityAssetClass: () => "equity",
  inferRecentSecurityMarket: () => "US",
}));

vi.mock("../realtime/useQuotesStream", () => ({
  useQuotesStore: (selector: (s: { marketStatus: null }) => unknown) => selector({ marketStatus: null }),
}));

vi.mock("../api/client", () => ({
  searchSymbols: vi.fn(async () => []),
  fetchCryptoSearch: vi.fn(async () => []),
}));

describe("TopBar navigation simplification (issue #26)", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("does not render the duplicate horizontal primary route row", () => {
    render(
      <MemoryRouter initialEntries={["/equity/chart-workstation"]}>
        <TopBar />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("topbar-primary-nav")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^HOME$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^SCREENER$/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("topbar-ticker-load")).toBeInTheDocument();
  });
});
