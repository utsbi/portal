"use client";

import { shaderMaterial, useTexture } from "@react-three/drei";
import { extend, useFrame } from "@react-three/fiber";
import { forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";

export type GlobeStyle = "wireframe" | "dotted" | "earth";

export interface GlobeRef {
  group: THREE.Group | null;
}

interface GlobeProps {
  radius?: number;
  style?: GlobeStyle;
  autoRotate?: boolean;
  rotationSpeed?: number;
  initialRotation?: number;
  children?: React.ReactNode;
}

const WireframeGlobeMaterial = shaderMaterial(
  {
    uColor: new THREE.Color("#22c55e"),
    uOpacity: 0.25,
    uGridSize: 12.0,
    uLineWidth: 0.015,
  },
  `
    varying vec2 vUv;
    varying vec3 vNormal;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uGridSize;
    uniform float uLineWidth;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    
    void main() {
      float lat = fract(vUv.y * uGridSize);
      float lng = fract(vUv.x * uGridSize * 2.0);
      
      float latLine = smoothstep(uLineWidth, 0.0, lat) + smoothstep(1.0 - uLineWidth, 1.0, lat);
      float lngLine = smoothstep(uLineWidth, 0.0, lng) + smoothstep(1.0 - uLineWidth, 1.0, lng);
      
      float grid = max(latLine, lngLine);
      
      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
      float finalOpacity = grid * uOpacity + fresnel * 0.05;
      
      gl_FragColor = vec4(uColor, finalOpacity);
    }
  `,
);

const DottedGlobeMaterial = shaderMaterial(
  {
    uColor: new THREE.Color("#22c55e"),
    uOpacity: 0.4,
    uDotSize: 40.0,
    uDotSpacing: 0.08,
  },
  `
    varying vec2 vUv;
    varying vec3 vNormal;
    
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uDotSize;
    uniform float uDotSpacing;
    
    varying vec2 vUv;
    varying vec3 vNormal;
    
    void main() {
      vec2 gridUv = vUv * uDotSize;
      vec2 gridFract = fract(gridUv);
      
      float dist = length(gridFract - 0.5);
      float dotPattern = 1.0 - smoothstep(uDotSpacing - 0.02, uDotSpacing, dist);
      
      float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 1.5);
      float finalOpacity = dotPattern * uOpacity * (0.5 + fresnel * 0.5);
      
      gl_FragColor = vec4(uColor, finalOpacity);
    }
  `,
);

extend({ WireframeGlobeMaterial, DottedGlobeMaterial });

// Local high-resolution textures
const EARTH_TEXTURE_URL = "/textures/world.200401.3x5400x2700.jpg";
// Cloud texture - add to public/textures/ when available
const CLOUD_TEXTURE_URL = "/textures/8k_earth_clouds.jpg"
// "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_clouds_2048.png";

function EarthMaterial() {
  const texture = useTexture(EARTH_TEXTURE_URL);

  return (
    <meshStandardMaterial
      map={texture}
      roughness={0.8}
      metalness={0.0}
    />
  );
}

function CloudLayer({ radius }: { radius: number }) {
  const cloudTexture = useTexture(CLOUD_TEXTURE_URL);
  const meshRef = useRef<THREE.Mesh>(null);

  // Rotate clouds slightly faster than the earth for realism
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.00012;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius * 1.012, 64, 64]} />
      <meshStandardMaterial
        map={cloudTexture}
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </mesh>
  );
}

declare module "@react-three/fiber" {
  interface ThreeElements {
    wireframeGlobeMaterial: React.JSX.IntrinsicElements["shaderMaterial"] & {
      uColor?: THREE.Color;
      uOpacity?: number;
      uGridSize?: number;
      uLineWidth?: number;
    };
    dottedGlobeMaterial: React.JSX.IntrinsicElements["shaderMaterial"] & {
      uColor?: THREE.Color;
      uOpacity?: number;
      uDotSize?: number;
      uDotSpacing?: number;
    };
  }
}

export const Globe = forwardRef<GlobeRef, GlobeProps>(function Globe(
  {
    radius = 1,
    style = "earth",
    autoRotate = true,
    rotationSpeed = 0.001,
    initialRotation = 0,
    children,
  },
  ref,
) {
  const groupRef = useRef<THREE.Group>(null);
  const initializedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    group: groupRef.current,
  }));

  const geometry = useMemo(
    () => new THREE.SphereGeometry(radius, 64, 64),
    [radius],
  );

  // Dispose geometry on unmount or when radius changes
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  // Set initial rotation on mount
  useEffect(() => {
    if (groupRef.current && !initializedRef.current) {
      groupRef.current.rotation.y = initialRotation;
      initializedRef.current = true;
    }
  }, [initialRotation]);

  useFrame(() => {
    if (groupRef.current && autoRotate) {
      groupRef.current.rotation.y += rotationSpeed;
    }
  });

  const renderMaterial = () => {
    switch (style) {
      case "wireframe":
        return (
          <wireframeGlobeMaterial
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        );
      case "dotted":
        return (
          <dottedGlobeMaterial
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        );
      case "earth":
      default:
        return <EarthMaterial />;
    }
  };

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>{renderMaterial()}</mesh>
      {style === "earth" && (
        <Suspense fallback={null}>
          <CloudLayer radius={radius} />
        </Suspense>
      )}
      {children}
    </group>
  );
});
