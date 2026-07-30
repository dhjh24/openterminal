import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __testOnly,
  clearChunkRecoveryState,
  isRetryableChunkError,
  recoverFromStaleChunk,
} from "../utils/lazyWithRetry";

describe("isRetryableChunkError", () => {
  it("detects chunk load failure messages", () => {
    expect(isRetryableChunkError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isRetryableChunkError(new Error("Importing a module script failed"))).toBe(true);
    expect(isRetryableChunkError(new Error("Loading chunk 42 failed"))).toBe(true);
    expect(isRetryableChunkError(new Error("ChunkLoadError: something"))).toBe(true);
    expect(isRetryableChunkError(new Error("error loading dynamically imported module"))).toBe(true);
    expect(isRetryableChunkError(new Error("dynamically imported module failed"))).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isRetryableChunkError(new Error("syntax error"))).toBe(false);
    expect(isRetryableChunkError("plain string")).toBe(false);
    expect(isRetryableChunkError(null)).toBe(false);
  });
});

describe("recoverFromStaleChunk", () => {
  const replaceMock = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("__GIT_COMMIT__", "build-abc");
    replaceMock.mockReset();
    vi.stubGlobal("location", {
      href: "https://app.example.com/dashboard",
      replace: replaceMock,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("triggers one reload per build on retryable chunk errors", () => {
    const error = new Error("Failed to fetch dynamically imported module");

    expect(recoverFromStaleChunk(error)).toBe(true);
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock.mock.calls[0][0]).toContain("_otui_chunk_recovery=build-abc");

    const stored = sessionStorage.getItem(__testOnly.RECOVERY_STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored!)).toEqual({ buildId: "build-abc", reloaded: true });
  });

  it("does not reload again for the same build (no loop)", () => {
    const error = new Error("Loading chunk 7 failed");
    __testOnly.writeRecoveryState("build-abc", true);

    expect(recoverFromStaleChunk(error)).toBe(false);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("allows another recovery when build id changes", () => {
    const error = new Error("chunkloaderror");
    __testOnly.writeRecoveryState("build-old", true);

    vi.stubGlobal("__GIT_COMMIT__", "build-new");
    expect(recoverFromStaleChunk(error)).toBe(true);
    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem(__testOnly.RECOVERY_STORAGE_KEY)!)).toEqual({
      buildId: "build-new",
      reloaded: true,
    });
  });

  it("returns false for non-retryable errors", () => {
    expect(recoverFromStaleChunk(new Error("random"))).toBe(false);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("clearChunkRecoveryState keeps flag for current build after reload", () => {
    __testOnly.writeRecoveryState("build-abc", true);
    clearChunkRecoveryState();
    expect(sessionStorage.getItem(__testOnly.RECOVERY_STORAGE_KEY)).toBeTruthy();
  });
});
