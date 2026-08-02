import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "../pages/LoginPage";

const loginMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    login: loginMock,
    isLoading: false,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("../components/MarketTicker", () => ({
  MarketTicker: () => <div data-testid="market-ticker" />,
}));

vi.mock("../components/StatusBar", () => ({
  StatusBar: () => <div data-testid="status-bar" />,
}));

describe("LoginPage demo access (issue #26)", () => {
  beforeEach(() => {
    loginMock.mockReset();
    navigateMock.mockReset();
    loginMock.mockResolvedValue(undefined);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("signs in immediately when Demo Access is pressed", async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: />\s*DEMO ACCESS/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("demo@openterminal.dev", "demo12345");
    });
  });

  it("links the footer to the current repository", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /github\.com\/dhjh24\/openterminal/i })).toHaveAttribute(
      "href",
      "https://github.com/dhjh24/openterminal",
    );
  });
});
