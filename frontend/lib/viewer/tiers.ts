/**
 * Network and device tiers for the 3D project viewer.
 *
 * The decision functions are pure so they can be unit tested; the `read*`
 * helpers sample the browser and return `{}` on the server.
 */

export type NetworkTier = "good" | "constrained";
export type DeviceTier = "low" | "high";

export interface NetworkSignals {
  saveData?: boolean;
  effectiveType?: string;
  prefersReducedData?: boolean;
}

export interface DeviceSignals {
  /** navigator.deviceMemory in GiB (Chromium only, capped at 8). */
  deviceMemory?: number;
  hardwareConcurrency?: number;
  coarsePointer?: boolean;
  /** Shorter side of the screen in CSS pixels. */
  screenShortSide?: number;
}

export interface ViewerQuality {
  tier: DeviceTier;
  /** Upper bound for the canvas pixel ratio; the viewer steps down from it when frames are slow. */
  maxDpr: number;
  antialias: boolean;
  /** Equirectangular HDR JPEG (gain map) used as scene background and environment light. */
  skyUrl: string;
  /** Parsed models kept in memory after the visitor switches away from them. */
  keepUnusedModels: number;
}

const SLOW_EFFECTIVE_TYPES = new Set(["slow-2g", "2g", "3g"]);

// Phones (touch + small screen) and machines reporting very little memory
// or very few cores render the models at reduced quality.
const SMALL_SCREEN_PX = 768;
const LOW_MEMORY_GB = 2;
const LOW_CORE_COUNT = 2;

export const SKY_URL_2K = "/textures/spruit_sunrise_2k.jpg";
export const SKY_URL_1K = "/textures/spruit_sunrise_1k.jpg";

/** Self-hosted Draco decoder; keep in sync with lib/security/csp.ts. */
export const DRACO_DECODER_PATH = "/draco/";
export const DRACO_DECODER_FILES = [
  `${DRACO_DECODER_PATH}draco_wasm_wrapper.js`,
  `${DRACO_DECODER_PATH}draco_decoder.wasm`,
];

/** Constrained connections never download a model without being asked. */
export function getNetworkTier(signals: NetworkSignals): NetworkTier {
  if (signals.saveData || signals.prefersReducedData) return "constrained";
  if (signals.effectiveType && SLOW_EFFECTIVE_TYPES.has(signals.effectiveType))
    return "constrained";
  return "good";
}

export function getDeviceTier(signals: DeviceSignals): DeviceTier {
  const { deviceMemory, hardwareConcurrency, coarsePointer, screenShortSide } =
    signals;
  if (
    coarsePointer &&
    screenShortSide !== undefined &&
    screenShortSide < SMALL_SCREEN_PX
  )
    return "low";
  if (deviceMemory !== undefined && deviceMemory <= LOW_MEMORY_GB) return "low";
  if (
    hardwareConcurrency !== undefined &&
    hardwareConcurrency <= LOW_CORE_COUNT
  )
    return "low";
  return "high";
}

export function getViewerQuality(tier: DeviceTier): ViewerQuality {
  return tier === "low"
    ? {
        tier,
        maxDpr: 1,
        antialias: false,
        skyUrl: SKY_URL_1K,
        keepUnusedModels: 0,
      }
    : {
        tier,
        maxDpr: 1.5,
        antialias: true,
        skyUrl: SKY_URL_2K,
        keepUnusedModels: 1,
      };
}

/** "2.9 MB" — one decimal below 10 MB, whole numbers above. */
export function formatMegabytes(megabytes: number): string {
  const value =
    megabytes < 10 ? megabytes.toFixed(1) : String(Math.round(megabytes));
  return `${value} MB`;
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

type NavigatorWithHints = Navigator & {
  connection?: NetworkInformationLike;
  deviceMemory?: number;
};

export function getNetworkInformation(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as NavigatorWithHints).connection;
}

export const REDUCED_DATA_QUERY = "(prefers-reduced-data: reduce)";

function matches(query: string): boolean {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia(query).matches
    : false;
}

export function readNetworkSignals(): NetworkSignals {
  if (typeof window === "undefined") return {};
  const connection = getNetworkInformation();
  return {
    saveData: connection?.saveData,
    effectiveType: connection?.effectiveType,
    prefersReducedData: matches(REDUCED_DATA_QUERY),
  };
}

export function readDeviceSignals(): DeviceSignals {
  if (typeof window === "undefined") return {};
  const nav = navigator as NavigatorWithHints;
  return {
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency || undefined,
    coarsePointer: matches("(pointer: coarse)"),
    screenShortSide: Math.min(window.screen.width, window.screen.height),
  };
}
