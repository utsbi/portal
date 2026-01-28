"use client";

import {
  CameraControls,
  ContactShadows,
  useEnvironment,
  useGLTF,
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
import type { CameraPreset } from "@/lib/data/projects";

const HDRI = "/models/spruit_sunrise_4k.jpg";
const AUTO_ROTATE_RESUME_DELAY_MS = 5000;

// =============================================================================
// Types
// =============================================================================

export interface Project3DViewerProps {
  modelUrl: string;
  cameraPresets?: CameraPreset[] | null;
  autoRotate?: boolean;
  onCameraChange?: (index: number) => void;
  onLoadProgress?: (percent: number) => void;
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
  setModelRef?: (ref: React.RefObject<THREE.Group | null>) => void;
}

interface AutoRotateControllerProps {
  enabled: boolean;
  cameraControlsRef: React.RefObject<CameraControls | null>;
}

interface SceneContentProps {
  modelUrl: string;
  cameraPresets?: CameraPreset[] | null;
  autoRotateEnabled: boolean;
  activeCameraIndex: number;
  cameraControlsRef: React.RefObject<CameraControls | null>;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  setModelRef: (ref: React.RefObject<THREE.Group | null>) => void;
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
  const { camera } = useThree();

  useFrame(() => {
    if (camera.position.y < minHeight) {
      camera.position.y = minHeight;
      if (cameraControlsRef?.current) {
        cameraControlsRef.current.update(0);
      }
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
          mesh.frustumCulled = false;

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
  useFrame((_, delta) => {
    if (enabled && cameraControlsRef?.current) {
      cameraControlsRef.current.azimuthAngle += delta * 0.1;
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

const Model: React.FC<ModelProps> = ({ url, setModelRef }) => {
  const { scene } = useGLTF(url);
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    if (setModelRef && group.current) {
      setModelRef(group);
    }
  }, [setModelRef]);

  return (
    <group ref={group} position={[0, 0, 0]} dispose={null}>
      <primitive object={scene} />
    </group>
  );
};

// =============================================================================
// Scene Content
// =============================================================================

const SceneContent: React.FC<SceneContentProps> = ({
  modelUrl,
  cameraPresets,
  autoRotateEnabled,
  activeCameraIndex,
  cameraControlsRef,
  onInteractionStart,
  onInteractionEnd,
  setModelRef,
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

      <Model url={modelUrl} setModelRef={handleSetModelRef} />

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
        minDistance={1}
        maxDistance={3000}
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
      autoRotate = true,
      onCameraChange,
      onLoadProgress: _onLoadProgress,
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

    useEffect(() => {
      useGLTF.preload(modelUrl);
    }, [modelUrl]);

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
          cameraControlsRef.current?.setLookAt(6.5, 615, 1015, 0, 0, 0, true);
          setActiveCameraIndex(-1);
          if (autoRotate) {
            timeoutRef.current = setTimeout(() => {
              setAutoRotateEnabled(true);
            }, AUTO_ROTATE_RESUME_DELAY_MS);
          }
        },
        zoomIn: () => {
          cameraControlsRef.current?.dolly(50, true);
        },
        zoomOut: () => {
          cameraControlsRef.current?.dolly(-50, true);
        },
      }),
      [onCameraChange, autoRotate],
    );

    const handleSetModelRef = useCallback(
      (ref: React.RefObject<THREE.Group | null>) => {
        modelRefState.current = ref;
      },
      [],
    );

    return (
      <div className="w-full h-full relative">
        <Canvas
          dpr={[1, 2]}
          camera={{
            position: [6.319, 614.043, 1012.865],
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
          frameloop="always"
          performance={{ min: 0.5 }}
        >
          <Suspense fallback={null}>
            <SceneContent
              modelUrl={modelUrl}
              cameraPresets={cameraPresets}
              autoRotateEnabled={autoRotateEnabled}
              activeCameraIndex={activeCameraIndex}
              cameraControlsRef={cameraControlsRef}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
              setModelRef={handleSetModelRef}
            />
          </Suspense>
        </Canvas>
      </div>
    );
  },
);

Project3DViewer.displayName = "Project3DViewer";
