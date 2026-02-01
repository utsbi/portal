"use client";

import {
  CameraControls,
  ContactShadows,
  useEnvironment,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type React from "react";
import {
  forwardRef,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import type {
  CameraConfig,
  CameraLimits,
  CameraPreset,
} from "@/lib/data/projects";

const HDRI = "/models/spruit_sunrise_4k.jpg";
const AUTO_ROTATE_RESUME_DELAY_MS = 5000;
const FALLBACK_CAMERA_POSITION: [number, number, number] = [6.5, 615, 1015];
const FALLBACK_CAMERA_TARGET: [number, number, number] = [0, 0, 0];

// =============================================================================
// Types
// =============================================================================

export interface Project3DViewerProps {
  modelUrl: string;
  cameraPresets?: CameraPreset[] | null;
  defaultCamera?: CameraConfig;
  cameraLimits?: CameraLimits;
  modelScale?: number;
  autoRotate?: boolean;
  onCameraChange?: (index: number) => void;
  onLoadProgress?: (percent: number) => void;
  onModelReady?: () => void;
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
}

interface CameraConstraintsProps {
  minHeight?: number;
  cameraControlsRef: React.RefObject<CameraControls | null>;
}

interface ModelOptimizerProps {
  houseRef: React.RefObject<THREE.Group | null> | null;
}

interface ModelProps {
  url: string;
  scale?: number;
  setModelRef?: (ref: React.RefObject<THREE.Group | null>) => void;
  onReady?: () => void;
}

interface AutoRotateControllerProps {
  enabled: boolean;
  cameraControlsRef: React.RefObject<CameraControls | null>;
}

interface SceneContentProps {
  modelUrl: string;
  cameraPresets?: CameraPreset[] | null;
  cameraLimits?: CameraLimits;
  modelScale?: number;
  autoRotateEnabled: boolean;
  activeCameraIndex: number;
  cameraControlsRef: React.RefObject<CameraControls | null>;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  setModelRef: (ref: React.RefObject<THREE.Group | null>) => void;
  onModelReady?: () => void;
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
      <div className="text-sbi-green font-bold text-xs mb-2">
        Camera Debug
      </div>
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

const SceneEnvironment: React.FC<SceneEnvironmentProps> = ({ path }) => {
  const envMap = useEnvironment({ files: path });
  const { scene } = useThree();

  useEffect(() => {
    if (envMap) {
      scene.background = envMap;
      scene.environment = envMap;
      envMap.rotation = Math.PI / 2;
    }

    return () => {
      if (scene.background === envMap) {
        scene.background = null;
      }
      if (scene.environment === envMap) {
        scene.environment = null;
      }
    };
  }, [envMap, scene]);

  return null;
};

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

const ModelOptimizer: React.FC<ModelOptimizerProps> = ({ houseRef }) => {
  useEffect(() => {
    if (houseRef?.current) {
      houseRef.current.traverse((object) => {
        if (object.type === "Mesh") {
          const mesh = object as THREE.Mesh;
          mesh.frustumCulled = true;

          if (mesh.material) {
            const material = mesh.material as THREE.Material;
            material.needsUpdate = true;
            if ("side" in material) {
              (material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
            }

            if ("transparent" in material && material.transparent) {
              if ("alphaTest" in material)
                (material as THREE.MeshStandardMaterial).alphaTest = 0.01;
              if ("depthWrite" in material)
                (material as THREE.MeshStandardMaterial).depthWrite = true;
            }
          }
        }
      });
    }
  }, [houseRef]);

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
        color="#ffffff"
        roughness={0.8}
        metalness={0.2}
        envMapIntensity={0.2}
        transparent={true}
        opacity={0.9}
      />
    </mesh>
  );
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

const Model: React.FC<ModelProps> = ({ url, scale = 1, setModelRef, onReady }) => {
  const { scene } = useGLTF(url, true);
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    if (setModelRef && group.current) {
      setModelRef(group);
    }
  }, [setModelRef]);

  // Signal that the model is loaded and rendered.
  // useGLTF suspends until the model is ready, so this effect
  // only fires once the model (cached or fetched) is available.
  useEffect(() => {
    onReady?.();
  }, [url, onReady]);

  return (
    <group ref={group} position={[0, 0, 0]} scale={scale}>
      <primitive object={scene} />
    </group>
  );
};

// =============================================================================
// Load Progress Reporter (bridges drei's useProgress to parent callback)
// =============================================================================

function LoadProgressReporter({
  onLoadProgress,
}: {
  onLoadProgress?: (percent: number) => void;
}) {
  const { progress } = useProgress();

  useEffect(() => {
    onLoadProgress?.(progress);
  }, [progress, onLoadProgress]);

  return null;
}

// =============================================================================
// Scene Content
// =============================================================================

const SceneContent: React.FC<SceneContentProps> = ({
  modelUrl,
  cameraPresets,
  cameraLimits,
  modelScale,
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
      <ambientLight intensity={0.3} />
      <spotLight
        intensity={0.3}
        angle={0.1}
        penumbra={1}
        position={[5, 25, 20]}
      />

      <Model url={modelUrl} scale={modelScale} setModelRef={handleSetModelRef} onReady={onModelReady} />

      {activeCameraIndex >= 0 && (
        <CameraSelector
          activeCameraIndex={activeCameraIndex}
          houseRef={modelRef}
          cameraControlsRef={cameraControlsRef}
          cameraPresets={cameraPresets}
        />
      )}

      <SceneEnvironment path={HDRI} />
      <ContactShadows
        rotation-x={Math.PI / 2}
        position={[0, -0.8, 0]}
        opacity={1}
      />
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

      <CameraConstraints minHeight={5} cameraControlsRef={cameraControlsRef} />
      {modelRef && <ModelOptimizer houseRef={modelRef} />}
      <AutoRotateController
        enabled={autoRotateEnabled}
        cameraControlsRef={cameraControlsRef}
      />
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
      cameraPresets,
      defaultCamera,
      cameraLimits,
      modelScale,
      autoRotate = true,
      onCameraChange,
      onLoadProgress,
      onModelReady,
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

    // Debug state (dev-only, polling and rendering gated behind IS_DEV)
    const [debugData, setDebugData] = useState<DebugData | null>(null);
    const [boundingBox, setBoundingBox] = useState<BBoxData | null>(null);

    useEffect(() => {
      useGLTF.preload(modelUrl, true);
    }, [modelUrl]);

    // Reset camera when project changes (modelUrl changes)
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cam = (ctrl as any).camera as THREE.PerspectiveCamera;
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
            cameraControlsRef.current?.setLookAt(
              px, py, pz, tx, ty, tz, true,
            );
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

    return (
      <div className="w-full h-full relative">
        <Canvas
          dpr={[1, 1.5]}
          camera={{
            position: initialPosition,
            fov: 50,
            near: 0.1,
            far: 10000,
          }}
          linear
          gl={{
            antialias: true,
            logarithmicDepthBuffer: true,
            depth: true,
            stencil: false,
          }}
          frameloop="demand"
          performance={{ min: 0.5 }}
        >
          <Suspense fallback={null}>
            <SceneContent
              modelUrl={modelUrl}
              cameraPresets={cameraPresets}
              cameraLimits={cameraLimits}
              modelScale={modelScale}
              autoRotateEnabled={autoRotateEnabled}
              activeCameraIndex={activeCameraIndex}
              cameraControlsRef={cameraControlsRef}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
              setModelRef={handleSetModelRef}
              onModelReady={onModelReady}
            />
            <LoadProgressReporter onLoadProgress={onLoadProgress} />
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
