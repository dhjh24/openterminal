/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NumericValue } from "../../components/terminal/NumericValue";
import { MISSING } from "../format";

describe("NumericValue", () => {
  it("renders formatted price with aria direction when toned", () => {
    render(<NumericValue value={123.456} kind="price" tone="up" />);
    const node = screen.getByLabelText("positive value");
    expect(node).toHaveTextContent("123.46");
  });

  it("shows missing placeholder for invalid values", () => {
    render(<NumericValue value={NaN} />);
    expect(screen.getByText(MISSING)).toBeInTheDocument();
  });
});
