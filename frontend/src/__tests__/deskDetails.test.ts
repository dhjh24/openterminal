import { describe, expect, it, beforeEach } from "vitest";

import {
  HOME_DESK_DETAILS_STORAGE_KEY,
  readHomeDeskDetailsExpanded,
  writeHomeDeskDetailsExpanded,
} from "../home/deskDetails";

describe("deskDetails preference", () => {
  beforeEach(() => {
    localStorage.removeItem(HOME_DESK_DETAILS_STORAGE_KEY);
  });

  it("defaults to collapsed", () => {
    expect(readHomeDeskDetailsExpanded()).toBe(false);
  });

  it("persists expanded preference", () => {
    writeHomeDeskDetailsExpanded(true);
    expect(localStorage.getItem(HOME_DESK_DETAILS_STORAGE_KEY)).toBe("1");
    expect(readHomeDeskDetailsExpanded()).toBe(true);
    writeHomeDeskDetailsExpanded(false);
    expect(readHomeDeskDetailsExpanded()).toBe(false);
  });
});
