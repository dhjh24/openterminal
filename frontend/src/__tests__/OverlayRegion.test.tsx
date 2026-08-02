import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { OverlayPortal, OverlayRegionHost, OVERLAY_ROOT_ID } from "../components/layout/OverlayRegion";

describe("OverlayRegion", () => {
  afterEach(() => {
    cleanup();
    document.getElementById(OVERLAY_ROOT_ID)?.remove();
  });

  it("mounts the shared overlay host with the expected test id and id", () => {
    render(<OverlayRegionHost />);
    const host = screen.getByTestId("overlay-stack");
    expect(host.id).toBe(OVERLAY_ROOT_ID);
    expect(host.className).toContain("ot-overlay-stack");
  });

  it("portals children into the overlay host when present", () => {
    render(
      <>
        <OverlayRegionHost />
        <OverlayPortal>
          <div data-testid="ported-notice">Notice</div>
        </OverlayPortal>
      </>,
    );
    const host = screen.getByTestId("overlay-stack");
    const notice = screen.getByTestId("ported-notice");
    expect(host.contains(notice)).toBe(true);
  });

  it("keeps agent launcher out of fixed positioning in CSS", () => {
    const css = readFileSync(resolve(__dirname, "../agent/agentConsole.css"), "utf8");
    expect(css).toMatch(/\.ot-agent-launcher\s*\{[^}]*position:\s*static/s);
    expect(css).not.toMatch(/\.ot-agent-launcher\s*\{[^}]*position:\s*fixed/s);
  });

  it("positions the overlay stack above mobile bottom nav and below trading content collisions", () => {
    const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    expect(css).toMatch(/\.ot-overlay-stack\s*\{[^}]*--ot-overlay-bottom-phone:\s*calc\(3\.75rem/s);
    expect(css).toMatch(/\.ot-overlay-stack\s*\{[^}]*position:\s*fixed/s);
    expect(css).toMatch(/@media\s*\(max-width:\s*767px\)\s*\{[^}]*\.ot-overlay-stack\s*\{[^}]*bottom:\s*var\(--ot-overlay-bottom-phone\)/s);
    expect(css).toMatch(/bottom:\s*var\(--ot-overlay-bottom-desktop\)/);
  });
});
