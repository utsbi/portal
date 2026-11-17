/**
 * Network side of the 3D viewer: downloads model bytes with real progress and
 * warms the HTTP cache for the decoder and sky. Deliberately free of three.js
 * imports so the projects page can call it before the viewer chunk loads.
 */

import type { Project } from "@/lib/data/projects";
import {
  DRACO_DECODER_FILES,
  getDeviceTier,
  getNetworkTier,
  getViewerQuality,
  readDeviceSignals,
  readNetworkSignals,
} from "@/lib/viewer/tiers";

export interface ModelProgress {
  loaded: number;
  /** Expected size in bytes; Content-Length when usable, else the project's modelSizeMB. */
  total: number;
  done: boolean;
}

interface ModelDownload {
  promise: Promise<ArrayBuffer>;
  progress: ModelProgress;
  listeners: Set<(progress: ModelProgress) => void>;
  controller: AbortController;
}

const PROGRESS_INTERVAL_MS = 100;
const INTENT_DELAY_MS = 150;

const downloads = new Map<string, ModelDownload>();
const warmed = new Set<string>();

export function megabytesToBytes(megabytes?: number): number {
  return megabytes ? Math.round(megabytes * 1_000_000) : 0;
}

function notify(download: ModelDownload) {
  for (const listener of download.listeners) listener(download.progress);
}

async function readBody(
  response: Response,
  download: ModelDownload,
): Promise<ArrayBuffer> {
  // A compressed response reports the encoded length, but the stream yields
  // decoded bytes, so only trust Content-Length for identity encoding.
  const encoding = response.headers.get("content-encoding");
  const length = Number(response.headers.get("content-length"));
  if ((!encoding || encoding === "identity") && length > 0) {
    download.progress.total = length;
  }
  if (!response.body) return response.arrayBuffer();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let lastNotify = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    download.progress.loaded = loaded;
    const now = performance.now();
    if (now - lastNotify > PROGRESS_INTERVAL_MS) {
      lastNotify = now;
      notify(download);
    }
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

/**
 * Starts (or joins) the download of a model. The bytes stay in memory until
 * the viewer parses them and calls releaseModelBytes.
 */
export function fetchModelBytes(
  url: string,
  expectedBytes = 0,
  priority: RequestPriority = "auto",
): Promise<ArrayBuffer> {
  const existing = downloads.get(url);
  if (existing) return existing.promise;

  const download: ModelDownload = {
    promise: Promise.resolve(new ArrayBuffer(0)),
    progress: { loaded: 0, total: expectedBytes, done: false },
    listeners: new Set(),
    controller: new AbortController(),
  };
  download.promise = fetch(url, {
    credentials: "same-origin",
    priority,
    signal: download.controller.signal,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Model request failed (${response.status}): ${url}`);
      }
      return readBody(response, download);
    })
    .then((buffer) => {
      download.progress = {
        loaded: buffer.byteLength,
        total: buffer.byteLength,
        done: true,
      };
      notify(download);
      return buffer;
    })
    .catch((error: unknown) => {
      // Forget failed downloads so a later visit can retry.
      if (downloads.get(url) === download) downloads.delete(url);
      throw error;
    });
  // Unclaimed preloads must not surface as unhandled rejections.
  download.promise.catch(() => {});
  downloads.set(url, download);
  return download.promise;
}

/** Drops the downloaded bytes once they have been parsed. */
export function releaseModelBytes(url: string, bytes: Promise<ArrayBuffer>) {
  if (downloads.get(url)?.promise === bytes) downloads.delete(url);
}

/** Stops a download nobody needs anymore (e.g. the visitor switched project). */
export function abortModelBytes(url: string) {
  const download = downloads.get(url);
  if (!download || download.progress.done) return;
  downloads.delete(url);
  download.controller.abort();
}

export function subscribeModelProgress(
  url: string,
  listener: (progress: ModelProgress) => void,
): () => void {
  const download = downloads.get(url);
  if (!download) return () => {};
  download.listeners.add(listener);
  listener(download.progress);
  return () => {
    download.listeners.delete(listener);
  };
}

/** Fire-and-forget request so a later loader fetch is served from the HTTP cache. */
export function warmAsset(url: string, priority: RequestPriority = "low") {
  if (warmed.has(url) || typeof fetch === "undefined") return;
  warmed.add(url);
  fetch(url, { credentials: "same-origin", priority })
    .then((response) => response.arrayBuffer())
    .catch(() => warmed.delete(url));
}

/** Requests the model, Draco decoder and sky in parallel instead of in a waterfall. */
export function startModelAssets(
  modelUrl: string,
  expectedBytes: number,
  skyUrl: string,
  priority: RequestPriority = "auto",
) {
  fetchModelBytes(modelUrl, expectedBytes, priority).catch(() => {});
  for (const file of DRACO_DECODER_FILES) warmAsset(file, priority);
  warmAsset(skyUrl, priority);
}

function preloadProjectModel(project: Project) {
  if (!project.has3D || !project.modelUrl) return;
  if (getNetworkTier(readNetworkSignals()) !== "good") return;
  const tier = getDeviceTier(readDeviceSignals());
  // Low-tier devices keep only the model on screen in memory.
  if (tier === "low") return;
  // Separate chunk: three.js stays out of the page bundle.
  import("./Project3DViewer").catch(() => {});
  startModelAssets(
    project.modelUrl,
    megabytesToBytes(project.modelSizeMB),
    getViewerQuality(tier).skyUrl,
    "low",
  );
}

let intentTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Hover/focus handlers for project links: on good connections a short hover
 * (or keyboard focus) starts downloading that project's model.
 */
export function modelIntentHandlers(project: Project) {
  if (!project.has3D || !project.modelUrl) return {};
  const cancel = () => {
    if (intentTimer) clearTimeout(intentTimer);
    intentTimer = null;
  };
  return {
    onPointerEnter: (event: { pointerType: string }) => {
      // Touch "hovers" arrive right before the click that loads the model anyway.
      if (event.pointerType !== "mouse") return;
      cancel();
      intentTimer = setTimeout(
        () => preloadProjectModel(project),
        INTENT_DELAY_MS,
      );
    },
    onPointerLeave: cancel,
    onFocus: () => preloadProjectModel(project),
  };
}
