"use client";

import { CameraControls, useEnvironment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import React, {
  forwardRef,
  Suspense,
  use,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type {
  CameraConfig,
  CameraLimits,
  CameraPreset,
} from "@/lib/data/projects";
import {
  FILL_GROUND_COLOR,
  FILL_SKY_COLOR,
  GROUND_COLOR,
  KEY_COLOR,
  KEY_POSITION,
  resolveLighting,
  type ViewerLighting,
} from "@/lib/viewer/lighting";
import type { ViewerQuality } from "@/lib/viewer/tiers";
import {
  loadModel,
  releaseDecoder,
  releaseModel,
  retainModel,
} from "./modelCache";

const AUTO_ROTATE_RESUME_DELAY_MS = 5000;
const FALLBACK_CAMERA_POSITION: [number, number, number] = [6.5, 615, 1015];
const FALLBACK_CAMERA_TARGET: [number, number, number] = [0, 0, 0];

// No logarithmic depth buffer: it writes gl_FragDepth, which disables early
// depth testing for every fragment of these 0.4-1.6M triangle models. Depth
// precision comes from the near plane instead, which follows the orbit
// distance: interior presets look 10 units ahead and keep 0.1, the
// family-home overview (~1200 units) gets ~6. Side-by-side renders of every
// preset showed no z-fighting difference against the log buffer.
const NEAR_PER_DISTANCE = 0.005;
const MIN_NEAR = 0.1;
const FAR = 10000;

// Frame-time sampling for the adaptive pixel ratio. Gaps longer than
// IDLE_GAP_MS are the demand frameloop resting, not slow frames.
const IDLE_GAP_MS = 100;
const FRAMES_PER_SAMPLE = 30;
const SLOW_FRAME_MS = 1000 / 45;
const FAST_FRAME_MS = 1000 / 57;
const FAST_SAMPLES_TO_RAISE = 3;
const DPR_STEP = 0.25;
const MAX_DPR_RAISES = 2;

// =============================================================================
// Types
// =============================================================================

export interface Project3DViewerProps {
  modelUrl: string;
  /** Expected model size, for progress when Content-Length is unusable. */
  modelSizeBytes?: number;
  quality: ViewerQuality;
  cameraPresets?: CameraPreset[] | null;
  defaultCamera?: CameraConfig;
  cameraLimits?: CameraLimits;
  modelScale?: number;
  /** Per-project adjustments on top of DEFAULT_LIGHTING. */
  lighting?: Partial<ViewerLighting>;
  autoRotate?: boolean;
  onCameraChange?: (index: number) => void;
  /** Called with the model URL once it is on screen with shaders compiled. */
  onModelReady?: (modelUrl: string) => void;
  /** The browser dropped the WebGL context (common on low-memory phones). */
  onContextLost?: () => void;
}

export interface Project3DViewerRef {
  setCamera: (index: number) => void;
  resetCamera: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface CameraSelectorProps {
  activeCameraIndex: number;
  houseRef: React.RefObject<THREE.Group | null> | null;
  cameraControlsRef: React.RefObject<CameraControls | null>;
  cameraPresets?: CameraPreset[] | null;
}

interface SceneEnvironmentProps {
  path: string;
  backgroundIntensity: number;
}

interface CameraConstraintsProps {
  minHeight?: number;
  cameraControlsRef: React.RefObject<CameraControls | null>;
}

interface ModelProps {
  url: string;
  expectedBytes: number;
  keepUnused: number;
  scale?: number;
  setModelRef?: (ref: React.RefObject<THREE.Group | null>) => void;
}

interface AutoRotateControllerProps {
  enabled: boolean;
  cameraControlsRef: React.RefObject<CameraControls | null>;
}

interface SceneContentProps {
  modelUrl: string;
  modelSizeBytes: number;
  quality: ViewerQuality;
  cameraPresets?: CameraPreset[] | null;
  defaultCamera?: CameraConfig;
  cameraLimits?: CameraLimits;
  modelScale?: number;
  lighting: ViewerLighting;
  autoRotateEnabled: boolean;
  activeCameraIndex: number;
  cameraControlsRef: React.RefObject<CameraControls | null>;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  setModelRef: (ref: React.RefObject<THREE.Group | null>) => void;
  onModelReady?: (modelUrl: string) => void;
}

// =============================================================================
// Debug Panel (dev-only, HTML overlay)
// =============================================================================

const IS_DEV = process.env.NODE_ENV === "development";

interface DebugData {
  position: [number, number, number];
  target: [number, number, number];
  distance: number;
}

interface BBoxData {
  size: [number, number, number];
  center: [number, number, number];
}

const round = (n: number) => Math.round(n * 100) / 100;

function DebugPanel({
  debugData,
  boundingBox,
}: {
  debugData: DebugData | null;
  boundingBox: BBoxData | null;
}) {
  const handleCopy = () => {
    if (!debugData) return;
    const snippet = [
      "defaultCamera: {",
      `  position: [${debugData.position.join(", ")}],`,
      `  target: [${debugData.target.join(", ")}],`,
      "},",
    ].join("\n");
    navigator.clipboard.writeText(snippet);
  };

  if (!debugData) return null;

  return (
    <div className="absolute top-4 right-4 z-30 bg-black/80 backdrop-blur-sm text-white text-[11px] font-mono p-3 rounded-lg border border-white/10 space-y-1.5 min-w-[220px] pointer-events-auto select-text">
      <div className="text-sbi-green font-bold text-xs mb-2">Camera Debug</div>
      <div>
        <span className="text-white/40">pos </span>
        <span>
          {debugData.position[0]} {debugData.position[1]}{" "}
          {debugData.position[2]}
        </span>
      </div>
      <div>
        <span className="text-white/40">tgt </span>
        <span>
          {debugData.target[0]} {debugData.target[1]} {debugData.target[2]}
        </span>
      </div>
      <div>
        <span className="text-white/40">dst </span>
        <span>{debugData.distance}</span>
      </div>
      {boundingBox && (
        <>
          <div className="border-t border-white/10 pt-1.5 mt-1.5">
            <span className="text-white/40">box </span>
            <span>
              {boundingBox.size[0]} x {boundingBox.size[1]} x{" "}
              {boundingBox.size[2]}
            </span>
          </div>
          <div>
            <span className="text-white/40">ctr </span>
            <span>{boundingBox.center.join(", ")}</span>
          </div>
        </>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="w-full mt-2 px-2 py-1 bg-sbi-green/20 text-sbi-green border border-sbi-green/30 rounded text-[10px] hover:bg-sbi-green/30 transition-colors"
      >
        Copy defaultCamera
      </button>
    </div>
  );
}

// =============================================================================
// Scene Helpers
// =============================================================================

/**
 * The sunrise sky is the visible backdrop only. As image-based light its HDR
 * sun turns every surface facing it yellow, so lighting comes from
 * NeutralEnvironment instead.
 */
const SceneEnvironment: React.FC<SceneEnvironmentProps> = ({
  path,
  backgroundIntensity,
}) => {
  const envMap = useEnvironment({ files: path });
  const { scene, invalidate } = useThree();

  useEffect(() => {
    scene.backgroundIntensity = backgroundIntensity;
    invalidate();
  }, [scene, backgroundIntensity, invalidate]);

  useEffect(() => {
    if (envMap) {
      scene.background = envMap;
      envMap.rotation = Math.PI / 2;
    }

    return () => {
      if (scene.background === envMap) {
        scene.background = null;
      }
    };
  }, [envMap, scene]);

  return null;
};

/**
 * Neutral grey studio environment (three's RoomEnvironment) for diffuse
 * light and reflections. Prefiltered once per renderer; nothing per frame.
 */
const NeutralEnvironment: React.FC<{ intensity: number }> = ({ intensity }) => {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    scene.environment = target.texture;
    invalidate();
    return () => {
      if (scene.environment === target.texture) scene.environment = null;
      target.dispose();
    };
  }, [gl, scene, invalidate]);

  useEffect(() => {
    scene.environmentIntensity = intensity;
    invalidate();
  }, [scene, intensity, invalidate]);

  return null;
};

/**
 * A missing or undecodable sky should cost the backdrop, not the model:
 * without this the whole viewer would fall back to the image gallery.
 */
class EnvironmentBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn("3D viewer environment failed to load:", error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const CameraConstraints: React.FC<CameraConstraintsProps> = ({
  minHeight = 5,
  cameraControlsRef,
}) => {
  const { camera, invalidate } = useThree();

  useFrame(() => {
    if (camera.position.y < minHeight) {
      camera.position.y = minHeight;
      if (cameraControlsRef?.current) {
        cameraControlsRef.current.update(0);
      }
      invalidate();
    }
  });

  return null;
};

/** Keeps the near plane proportional to the orbit distance (see NEAR_PER_DISTANCE). */
const ClipPlanes: React.FC<{
  cameraControlsRef: React.RefObject<CameraControls | null>;
}> = ({ cameraControlsRef }) => {
  useFrame(({ camera }) => {
    const distance = cameraControlsRef.current?.distance;
    if (!distance || !(camera instanceof THREE.PerspectiveCamera)) return;
    const near = Math.max(MIN_NEAR, distance * NEAR_PER_DISTANCE);
    if (Math.abs(near - camera.near) > camera.near * 0.1) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  });
  return null;
};

const Ground: React.FC = () => {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      receiveShadow
    >
      <planeGeometry args={[15000, 10000]} />
      <meshStandardMaterial
        color={GROUND_COLOR}
        roughness={1}
        metalness={0}
        envMapIntensity={0.2}
        transparent={true}
        opacity={0.9}
        // The plane sits 0.01 below floors at y=0; bias it back in depth so
        // it never shows through them from far away.
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  );
};

/**
 * Sets the camera to the project's default position & target on mount.
 * Runs inside the R3F tree so CameraControls ref is guaranteed to be
 * populated. Handles Canvas remount after visiting a non-3D project.
 */
const CameraInitializer: React.FC<{
  defaultCamera?: CameraConfig;
  cameraControlsRef: React.RefObject<CameraControls | null>;
}> = ({ defaultCamera, cameraControlsRef }) => {
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-time camera initialization that must run only once after the Canvas mounts; including defaultCamera/ref would re-run and fight user camera interactions
  useEffect(() => {
    if (defaultCamera && cameraControlsRef.current) {
      const { position: p, target: t } = defaultCamera;
      cameraControlsRef.current.setLookAt(
        p[0],
        p[1],
        p[2],
        t[0],
        t[1],
        t[2],
        false,
      );
    }
  }, []);
  return null;
};

const AutoRotateController: React.FC<AutoRotateControllerProps> = ({
  enabled,
  cameraControlsRef,
}) => {
  const { invalidate } = useThree();
  useFrame((_, delta) => {
    if (enabled && cameraControlsRef?.current) {
      cameraControlsRef.current.azimuthAngle += delta * 0.1;
      invalidate();
    }
  });

  return null;
};

/**
 * Steps the pixel ratio down while interaction frames are slow and back up
 * when they recover. drei's PerformanceMonitor counts frames per wall-clock
 * window, which reads the idle gaps of frameloop="demand" as low FPS, so
 * this samples only back-to-back frames.
 */
const AdaptiveResolution: React.FC<{
  dpr: number;
  minDpr: number;
  maxDpr: number;
  onChange: (dpr: number) => void;
}> = ({ dpr, minDpr, maxDpr, onChange }) => {
  const sample = useRef({ last: 0, total: 0, count: 0, fast: 0, raises: 0 });

  useFrame(() => {
    const s = sample.current;
    const now = performance.now();
    const frameMs = now - s.last;
    s.last = now;
    if (frameMs > IDLE_GAP_MS) return;
    s.total += frameMs;
    s.count += 1;
    if (s.count < FRAMES_PER_SAMPLE) return;
    const average = s.total / s.count;
    s.total = 0;
    s.count = 0;

    if (average > SLOW_FRAME_MS && dpr > minDpr) {
      s.fast = 0;
      onChange(Math.max(minDpr, dpr - DPR_STEP));
    } else if (average < FAST_FRAME_MS && dpr < maxDpr) {
      s.fast += 1;
      if (s.fast >= FAST_SAMPLES_TO_RAISE && s.raises < MAX_DPR_RAISES) {
        s.fast = 0;
        s.raises += 1;
        onChange(Math.min(maxDpr, dpr + DPR_STEP));
      }
    } else {
      s.fast = 0;
    }
  });

  return null;
};

/** Hands a lost WebGL context to the parent, which falls back to the gallery. */
const ContextLossGuard: React.FC<{ onContextLost?: () => void }> = ({
  onContextLost,
}) => {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    if (!onContextLost) return;
    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", onContextLost);
    return () => canvas.removeEventListener("webglcontextlost", onContextLost);
  }, [gl, onContextLost]);

  return null;
};

/**
 * Rendered after the model and environment inside the same Suspense
 * boundary, so it runs once both are in the scene. Compiles every shader
 * (in parallel where KHR_parallel_shader_compile is available), draws a
 * frame, then reports the model as ready.
 */
const SceneReady: React.FC<{
  url: string;
  onReady?: (url: string) => void;
}> = ({ url, onReady }) => {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let active = true;
    gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .then(() => {
        if (!active) return;
        invalidate();
        requestAnimationFrame(() => {
          if (active) onReady?.(url);
        });
      });
    return () => {
      active = false;
    };
  }, [url, gl, scene, camera, invalidate, onReady]);

  return null;
};

// =============================================================================
// Camera Selector
// =============================================================================

const CameraSelector: React.FC<CameraSelectorProps> = ({
  activeCameraIndex,
  houseRef,
  cameraControlsRef,
  cameraPresets,
}) => {
  useEffect(() => {
    if (activeCameraIndex < 0) return;
    if (cameraPresets && activeCameraIndex >= cameraPresets.length) return;

    if (cameraPresets && cameraPresets.length > 0) {
      const preset = cameraPresets[activeCameraIndex];
      if (!preset || !cameraControlsRef?.current) return;

      if (preset.embeddedIndex !== undefined && houseRef?.current) {
        const camerasArray: THREE.PerspectiveCamera[] = [];
        houseRef.current.traverse((object) => {
          if (object.type === "PerspectiveCamera") {
            camerasArray.push(object as THREE.PerspectiveCamera);
          }
        });

        const cameraToUse = camerasArray[preset.embeddedIndex];
        if (cameraToUse) {
          const position = cameraToUse.position.clone();
          const direction = new THREE.Vector3(0, 0, -1);
          direction.applyQuaternion(cameraToUse.quaternion);
          const target = position.clone().add(direction.multiplyScalar(10));

          cameraControlsRef.current.setLookAt(
            position.x,
            position.y,
            position.z,
            target.x,
            target.y,
            target.z,
            true,
          );
          return;
        }
      }

      cameraControlsRef.current.setLookAt(
        preset.position[0],
        preset.position[1],
        preset.position[2],
        preset.target[0],
        preset.target[1],
        preset.target[2],
        true,
      );
      return;
    }

    if (houseRef?.current) {
      const camerasArray: THREE.PerspectiveCamera[] = [];
      houseRef.current.traverse((object) => {
        if (object.type === "PerspectiveCamera") {
          camerasArray.push(object as THREE.PerspectiveCamera);
        }
      });

      const cameraToUse = camerasArray[activeCameraIndex];
      if (cameraToUse && cameraControlsRef?.current) {
        const position = cameraToUse.position.clone();
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(cameraToUse.quaternion);
        const target = position.clone().add(direction.multiplyScalar(10));

        cameraControlsRef.current.setLookAt(
          position.x,
          position.y,
          position.z,
          target.x,
          target.y,
          target.z,
          true,
        );
      }
    }
  }, [activeCameraIndex, houseRef, cameraControlsRef, cameraPresets]);

  return null;
};

// =============================================================================
// Model
// =============================================================================

const Model: React.FC<ModelProps> = ({
  url,
  expectedBytes,
  keepUnused,
  scale = 1,
  setModelRef,
}) => {
  // Suspends until downloaded and decoded; null if the download was dropped.
  const gltf = use(loadModel(url, expectedBytes));
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    if (setModelRef && group.current) {
      setModelRef(group);
    }
  }, [setModelRef]);

  // Release this model when another replaces it or the viewer unmounts.
  useEffect(() => {
    retainModel(url);
    return () => releaseModel(url, keepUnused);
  }, [url, keepUnused]);

  return (
    <group ref={group} position={[0, 0, 0]} scale={scale}>
      {gltf && <primitive object={gltf.scene} />}
    </group>
  );
};

// =============================================================================
// Scene Content
// =============================================================================

const SceneContent: React.FC<SceneContentProps> = ({
  modelUrl,
  modelSizeBytes,
  quality,
  cameraPresets,
  defaultCamera,
  cameraLimits,
  modelScale,
  lighting,
  autoRotateEnabled,
  activeCameraIndex,
  cameraControlsRef,
  onInteractionStart,
  onInteractionEnd,
  setModelRef,
  onModelReady,
}) => {
  const [modelRef, setModelRefState] =
    useState<React.RefObject<THREE.Group | null> | null>(null);

  const handleSetModelRef = useCallback(
    (ref: React.RefObject<THREE.Group | null>) => {
      setModelRefState(ref);
      setModelRef(ref);
    },
    [setModelRef],
  );

  return (
    <>
      {/* Neutral light (see lib/viewer/lighting.ts); no shadow maps. */}
      <NeutralEnvironment intensity={lighting.environmentIntensity} />
      <hemisphereLight
        name="viewer-fill"
        args={[FILL_SKY_COLOR, FILL_GROUND_COLOR, lighting.fillIntensity]}
      />
      <directionalLight
        name="viewer-key"
        color={KEY_COLOR}
        position={KEY_POSITION}
        intensity={lighting.keyIntensity}
      />

      <Model
        url={modelUrl}
        expectedBytes={modelSizeBytes}
        keepUnused={quality.keepUnusedModels}
        scale={modelScale}
        setModelRef={handleSetModelRef}
      />

      {activeCameraIndex >= 0 && (
        <CameraSelector
          activeCameraIndex={activeCameraIndex}
          houseRef={modelRef}
          cameraControlsRef={cameraControlsRef}
          cameraPresets={cameraPresets}
        />
      )}

      <EnvironmentBoundary>
        <SceneEnvironment
          path={quality.skyUrl}
          backgroundIntensity={lighting.backgroundIntensity}
        />
      </EnvironmentBoundary>
      <Ground />

      <CameraControls
        ref={cameraControlsRef}
        minDistance={cameraLimits?.minDistance ?? 1}
        maxDistance={cameraLimits?.maxDistance ?? 3000}
        dollySpeed={0.5}
        truckSpeed={0.5}
        verticalDragToForward={false}
        infinityDolly={false}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.05}
        boundaryEnclosesCamera={true}
        azimuthRotateSpeed={0.5}
        polarRotateSpeed={0.5}
        smoothTime={0.4}
        onStart={onInteractionStart}
        onEnd={onInteractionEnd}
      />

      <CameraInitializer
        defaultCamera={defaultCamera}
        cameraControlsRef={cameraControlsRef}
      />
      <CameraConstraints minHeight={5} cameraControlsRef={cameraControlsRef} />
      <ClipPlanes cameraControlsRef={cameraControlsRef} />
      <AutoRotateController
        enabled={autoRotateEnabled}
        cameraControlsRef={cameraControlsRef}
      />
      <SceneReady url={modelUrl} onReady={onModelReady} />
    </>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const Project3DViewer = forwardRef<
  Project3DViewerRef,
  Project3DViewerProps
>(
  (
    {
      modelUrl,
      modelSizeBytes = 0,
      quality,
      cameraPresets,
      defaultCamera,
      cameraLimits,
      modelScale,
      lighting: lightingOverrides,
      autoRotate = true,
      onCameraChange,
      onModelReady,
      onContextLost,
    },
    ref,
  ) => {
    const cameraControlsRef = useRef<CameraControls | null>(null);
    const modelRefState = useRef<React.RefObject<THREE.Group | null> | null>(
      null,
    );

    const [activeCameraIndex, setActiveCameraIndex] = useState<number>(-1);
    const [autoRotateEnabled, setAutoRotateEnabled] = useState(autoRotate);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFirstMount = useRef(true);

    // Highest useful pixel ratio on this screen; AdaptiveResolution moves
    // between 1 and this while frames are slow.
    const [maxDpr] = useState(() =>
      Math.max(1, Math.min(quality.maxDpr, window.devicePixelRatio || 1)),
    );
    const [dpr, setDpr] = useState(maxDpr);

    // Debug state (dev-only, polling and rendering gated behind IS_DEV)
    const [debugData, setDebugData] = useState<DebugData | null>(null);
    const [boundingBox, setBoundingBox] = useState<BBoxData | null>(null);

    // Low tier: drop the Draco workers (and their wasm heaps) once the
    // model on screen is decoded.
    const lowTier = quality.tier === "low";
    const handleModelReady = useCallback(
      (url: string) => {
        if (lowTier) releaseDecoder();
        onModelReady?.(url);
      },
      [lowTier, onModelReady],
    );

    // Reset camera when project changes (modelUrl changes)
    // biome-ignore lint/correctness/useExhaustiveDependencies: modelUrl is intentionally the trigger to reset the camera when the project/model changes, even though the effect body reads it indirectly
    useEffect(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      if (defaultCamera && cameraControlsRef.current) {
        const { position: p, target: t } = defaultCamera;
        cameraControlsRef.current.setLookAt(
          p[0],
          p[1],
          p[2],
          t[0],
          t[1],
          t[2],
          true,
        );
      }
      setActiveCameraIndex(-1);
      setAutoRotateEnabled(autoRotate);
    }, [modelUrl, defaultCamera, autoRotate]);

    // Poll camera data for debug panel (dev-only)
    useEffect(() => {
      if (!IS_DEV) return;
      const target = new THREE.Vector3();
      const interval = setInterval(() => {
        const ctrl = cameraControlsRef.current;
        if (!ctrl) return;
        const cam = (ctrl as unknown as { camera: THREE.PerspectiveCamera })
          .camera;
        if (!cam) return;
        ctrl.getTarget(target);
        setDebugData({
          position: [
            round(cam.position.x),
            round(cam.position.y),
            round(cam.position.z),
          ],
          target: [round(target.x), round(target.y), round(target.z)],
          distance: round(ctrl.distance),
        });
      }, 100);
      return () => clearInterval(interval);
    }, []);

    const handleInteractionStart = useCallback(() => {
      setAutoRotateEnabled(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }, []);

    const handleInteractionEnd = useCallback(() => {
      if (!autoRotate) return;
      timeoutRef.current = setTimeout(() => {
        setAutoRotateEnabled(true);
      }, AUTO_ROTATE_RESUME_DELAY_MS);
    }, [autoRotate]);

    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        setCamera: (index: number) => {
          setActiveCameraIndex(index);
          setAutoRotateEnabled(false);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          onCameraChange?.(index);
        },
        resetCamera: () => {
          if (defaultCamera && cameraControlsRef.current) {
            const { position: p, target: t } = defaultCamera;
            cameraControlsRef.current.setLookAt(
              p[0],
              p[1],
              p[2],
              t[0],
              t[1],
              t[2],
              true,
            );
          } else {
            const [px, py, pz] = FALLBACK_CAMERA_POSITION;
            const [tx, ty, tz] = FALLBACK_CAMERA_TARGET;
            cameraControlsRef.current?.setLookAt(px, py, pz, tx, ty, tz, true);
          }
          setActiveCameraIndex(-1);
          if (autoRotate) {
            timeoutRef.current = setTimeout(() => {
              setAutoRotateEnabled(true);
            }, AUTO_ROTATE_RESUME_DELAY_MS);
          }
        },
        zoomIn: () => {
          const distance = cameraControlsRef.current?.distance ?? 100;
          const step = Math.max(distance * 0.2, 1);
          cameraControlsRef.current?.dolly(step, true);
        },
        zoomOut: () => {
          const distance = cameraControlsRef.current?.distance ?? 100;
          const step = Math.max(distance * 0.2, 1);
          cameraControlsRef.current?.dolly(-step, true);
        },
      }),
      [onCameraChange, autoRotate, defaultCamera],
    );

    const handleSetModelRef = useCallback(
      (ref: React.RefObject<THREE.Group | null>) => {
        modelRefState.current = ref;
        if (IS_DEV && ref.current) {
          const box = new THREE.Box3().setFromObject(ref.current);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          setBoundingBox({
            size: [round(size.x), round(size.y), round(size.z)],
            center: [round(center.x), round(center.y), round(center.z)],
          });
        }
      },
      [],
    );

    const initialPosition = defaultCamera?.position ?? FALLBACK_CAMERA_POSITION;
    const lighting = useMemo(
      () => resolveLighting(lightingOverrides),
      [lightingOverrides],
    );

    return (
      <div className="w-full h-full relative">
        <Canvas
          dpr={dpr}
          camera={{
            position: initialPosition,
            fov: 50,
            near: MIN_NEAR,
            far: FAR,
          }}
          // sRGB output (R3F default; the old `linear` prop sent linear values
          // to the screen, crushing darks and oversaturating colours) with
          // neutral tone mapping, which keeps hues and whites as authored
          // where ACES shifts them.
          gl={{
            antialias: quality.antialias,
            logarithmicDepthBuffer: false,
            depth: true,
            stencil: false,
            toneMapping: THREE.NeutralToneMapping,
            toneMappingExposure: lighting.exposure,
          }}
          frameloop="demand"
        >
          <ContextLossGuard onContextLost={onContextLost} />
          {maxDpr > 1 && (
            <AdaptiveResolution
              dpr={dpr}
              minDpr={1}
              maxDpr={maxDpr}
              onChange={setDpr}
            />
          )}
          <Suspense fallback={null}>
            <SceneContent
              modelUrl={modelUrl}
              modelSizeBytes={modelSizeBytes}
              quality={quality}
              cameraPresets={cameraPresets}
              defaultCamera={defaultCamera}
              cameraLimits={cameraLimits}
              modelScale={modelScale}
              lighting={lighting}
              autoRotateEnabled={autoRotateEnabled}
              activeCameraIndex={activeCameraIndex}
              cameraControlsRef={cameraControlsRef}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
              setModelRef={handleSetModelRef}
              onModelReady={handleModelReady}
            />
          </Suspense>
        </Canvas>

        {IS_DEV && (
          <DebugPanel debugData={debugData} boundingBox={boundingBox} />
        )}
      </div>
    );
  },
);

Project3DViewer.displayName = "Project3DViewer";
