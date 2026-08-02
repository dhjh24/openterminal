import { describe, expect, it } from "vitest";

import {
  buildPaperOptionSymbol,
  estimatedDebit,
  optionSpread,
  selectContractFromStrike,
  type StrikeData,
} from "../fno/types/fno";

const sampleRow: StrikeData = {
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
};

describe("option paper trade helpers (issue #27)", () => {
  it("computes spread and estimated debit with the 100-share multiplier", () => {
    expect(optionSpread(3.1, 3.3)).toBeCloseTo(0.2);
    expect(estimatedDebit(3.3, 2)).toBeCloseTo(660);
  });

  it("prefers OCC contract symbols for paper orders", () => {
    expect(
      buildPaperOptionSymbol({
        underlying: "AAPL",
        expiry: "2025-08-15",
        side: "CE",
        strike: 150,
        contractSymbol: "AAPL250815C00150000",
      }),
    ).toBe("NASDAQ:AAPL250815C00150000");
  });

  it("builds a synthetic OCC-like symbol when contract id is missing", () => {
    expect(
      buildPaperOptionSymbol({
        underlying: "AAPL",
        expiry: "2025-08-15",
        side: "PE",
        strike: 150,
      }),
    ).toBe("NASDAQ:AAPL250815P00150000");
  });

  it("selects call contracts with bid/ask/spread/delta for the ticket", () => {
    const selected = selectContractFromStrike(sampleRow, "CE", "AAPL", "2025-08-15");
    expect(selected?.side).toBe("CE");
    expect(selected?.ask).toBe(3.3);
    expect(selected?.spread).toBeCloseTo(0.2);
    expect(selected?.delta).toBe(0.45);
    expect(selected?.contractSymbol).toBe("NASDAQ:AAPL250815C00150000");
  });
});
