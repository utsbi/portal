/**
 * Parsed-model cache for the 3D viewer. Imported only by Project3DViewer, so
 * three.js and the loaders stay in the lazily loaded viewer chunk.
 *
 * Unlike drei's useGLTF cache (which keeps every model forever), models are
 * reference counted: once no Model component shows one, all but the
 * `keepUnused` most recent are disposed and dropped.
 */

import * as THREE from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import {
  type GLTF,
  GLTFLoader,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { CLAY_COLOR } from "@/lib/viewer/lighting";
import { DRACO_DECODER_PATH } from "@/lib/viewer/tiers";
import { fetchModelBytes, releaseModelBytes } from "./modelAssets";

const models = new Map<string, Promise<GLTF | null>>();
const settled = new Map<string, GLTF>();
const users = new Map<string, number>();
/** Most recently shown first. */
let recent: string[] = [];

let dracoLoader: DRACOLoader | null = null;

function getDracoLoader() {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH);
  }
  return dracoLoader;
}

/**
 * glTF's default material (meshes exported without one, e.g. the uncoloured
 * hobbie farm) is fully metallic, which renders as a dark mirror. Shown as
 * matte clay instead, the way such models are meant to be read.
 */
function isLoaderDefaultMaterial(material: THREE.MeshStandardMaterial) {
  return (
    material.name === "" &&
    material.metalness === 1 &&
    material.roughness === 1 &&
    !material.map &&
    material.color.getHex() === 0xffffff
  );
}

/**
 * Applies the material tweaks once, before the first render, so shaders are
 * compiled a single time instead of being rebuilt after the model appears.
 */
function prepareScene(scene: THREE.Object3D) {
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material || Array.isArray(mesh.material)) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (material.isMeshStandardMaterial && isLoaderDefaultMaterial(material)) {
      material.color.set(CLAY_COLOR);
      material.metalness = 0;
      material.roughness = 0.85;
    }
    if (material.map) {
      material.map.generateMipmaps = false;
      material.map.minFilter = THREE.LinearFilter;
    }
    if (material.transparent) {
      material.side = THREE.DoubleSide;
      material.alphaTest = 0.01;
      material.depthWrite = true;
    }
  });
}

/**
 * Suspense resource for a model. The bytes may already be downloading
 * (ProjectModelView starts them before this chunk loads); the Draco
 * decoder is fetched and compiled in parallel with that download.
 *
 * Resolves to null when the download was aborted because the visitor
 * switched project; that model is no longer on screen, so it must not
 * trip the error fallback.
 */
export function loadModel(
  url: string,
  expectedBytes: number,
): Promise<GLTF | null> {
  const cached = models.get(url);
  if (cached) return cached;

  const draco = getDracoLoader();
  draco.preload();
  const bytes = fetchModelBytes(url, expectedBytes);
  const promise = bytes
    .then((buffer) => {
      const loader = new GLTFLoader();
      loader.setDRACOLoader(draco);
      loader.setMeshoptDecoder(MeshoptDecoder);
      return loader.parseAsync(buffer, THREE.LoaderUtils.extractUrlBase(url));
    })
    .then((gltf) => {
      prepareScene(gltf.scene);
      settled.set(url, gltf);
      return gltf;
    })
    .catch((error: unknown) => {
      // Forget failures so a later visit retries.
      if (models.get(url) === promise) models.delete(url);
      if (error instanceof DOMException && error.name === "AbortError")
        return null;
      throw error;
    })
    .finally(() => releaseModelBytes(url, bytes));
  models.set(url, promise);
  return promise;
}

function disposeModel(gltf: GLTF) {
  gltf.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

function evictUnused(keepUnused: number) {
  const unused = recent.filter(
    (url) => (users.get(url) ?? 0) === 0 && settled.has(url),
  );
  for (const url of unused.slice(keepUnused)) {
    const gltf = settled.get(url);
    settled.delete(url);
    models.delete(url);
    recent = recent.filter((entry) => entry !== url);
    if (gltf) disposeModel(gltf);
  }
}

export function retainModel(url: string) {
  users.set(url, (users.get(url) ?? 0) + 1);
  recent = [url, ...recent.filter((entry) => entry !== url)];
}

/**
 * Called when a Model stops showing `url`. Eviction is deferred a tick so a
 * remount of the same model (React Strict Mode, Suspense re-show) can
 * re-retain it first.
 */
export function releaseModel(url: string, keepUnused: number) {
  users.set(url, Math.max(0, (users.get(url) ?? 0) - 1));
  setTimeout(() => evictUnused(keepUnused), 0);
}

/**
 * Low-tier devices: terminate the decoder workers once nothing is decoding;
 * each holds a wasm heap as large as the biggest mesh it has decoded. A
 * disposed DRACOLoader cannot be reused, so the next model gets a new one.
 */
export function releaseDecoder() {
  if ([...models.keys()].some((url) => !settled.has(url))) return;
  dracoLoader?.dispose();
  dracoLoader = null;
}
