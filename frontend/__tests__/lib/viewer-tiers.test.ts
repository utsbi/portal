import { describe, expect, it } from "vitest";
import { projects } from "@/lib/data/projects";
import { DEFAULT_LIGHTING, resolveLighting } from "@/lib/viewer/lighting";
import {
  formatMegabytes,
  getDeviceTier,
  getNetworkTier,
  getViewerQuality,
} from "@/lib/viewer/tiers";

describe("getNetworkTier()", () => {
  it("auto-loads when the browser reports nothing (Safari, Firefox)", () => {
    expect(getNetworkTier({})).toBe("good");
  });

  it("auto-loads on 4g", () => {
    expect(getNetworkTier({ effectiveType: "4g", saveData: false })).toBe(
      "good",
    );
  });

  it.each(["slow-2g", "2g", "3g"])("waits for consent on %s", (type) => {
    expect(getNetworkTier({ effectiveType: type })).toBe("constrained");
  });

  it("waits for consent with Save-Data on, even on 4g", () => {
    expect(getNetworkTier({ effectiveType: "4g", saveData: true })).toBe(
      "constrained",
    );
  });

  it("waits for consent with prefers-reduced-data", () => {
    expect(getNetworkTier({ prefersReducedData: true })).toBe("constrained");
  });
});

describe("getDeviceTier()", () => {
  it("treats phones (touch + small screen) as low tier", () => {
    expect(
      getDeviceTier({
        coarsePointer: true,
        screenShortSide: 390,
        deviceMemory: 8,
        hardwareConcurrency: 8,
      }),
    ).toBe("low");
  });

  it("keeps tablets on the high tier", () => {
    expect(getDeviceTier({ coarsePointer: true, screenShortSide: 820 })).toBe(
      "high",
    );
  });

  it("treats 2 GB or 2-core machines as low tier", () => {
    expect(getDeviceTier({ deviceMemory: 2 })).toBe("low");
    expect(getDeviceTier({ hardwareConcurrency: 2 })).toBe("low");
  });

  it("defaults to high tier when nothing is reported", () => {
    expect(getDeviceTier({})).toBe("high");
    expect(
      getDeviceTier({
        coarsePointer: false,
        screenShortSide: 1080,
        deviceMemory: 8,
        hardwareConcurrency: 8,
      }),
    ).toBe("high");
  });
});

describe("getViewerQuality()", () => {
  it("drops pixel ratio, antialiasing, sky resolution and model cache on low tier", () => {
    const low = getViewerQuality("low");
    const high = getViewerQuality("high");
    expect(low.maxDpr).toBe(1);
    expect(low.antialias).toBe(false);
    expect(low.skyUrl).toMatch(/_1k\.jpg$/);
    expect(low.keepUnusedModels).toBe(0);
    expect(high.maxDpr).toBe(1.5);
    expect(high.antialias).toBe(true);
    expect(high.skyUrl).toMatch(/_2k\.jpg$/);
  });
});

describe("formatMegabytes()", () => {
  it("uses one decimal below 10 MB and whole numbers above", () => {
    expect(formatMegabytes(2.9)).toBe("2.9 MB");
    expect(formatMegabytes(0.66)).toBe("0.7 MB");
    expect(formatMegabytes(11.4)).toBe("11 MB");
  });
});

describe("project model data", () => {
  it("versions every model URL and states its size", () => {
    for (const project of projects.filter((p) => p.has3D)) {
      expect(project.modelUrl).toMatch(/^\/models\/[\w-]+\.glb\?v=\d+$/);
      expect(project.modelSizeMB).toBeGreaterThan(0);
    }
  });
});

describe("resolveLighting()", () => {
  it("returns the defaults without overrides", () => {
    expect(resolveLighting()).toEqual(DEFAULT_LIGHTING);
  });

  it("applies per-project overrides on top of the defaults", () => {
    const lighting = resolveLighting({ keyIntensity: 2.2 });
    expect(lighting.keyIntensity).toBe(2.2);
    expect(lighting.exposure).toBe(DEFAULT_LIGHTING.exposure);
  });

  it("keeps every project override within the known fields", () => {
    const keys = Object.keys(DEFAULT_LIGHTING);
    for (const project of projects) {
      for (const key of Object.keys(project.lighting ?? {})) {
        expect(keys).toContain(key);
      }
    }
  });
});
