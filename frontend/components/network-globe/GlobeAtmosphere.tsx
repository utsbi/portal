"use client";

import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

interface GlobeAtmosphereProps {
  radius?: number;
  color?: string;
  intensity?: number;
}

const AtmosphereMaterial = shaderMaterial(
  {
    uColor: new THREE.Color("#22c55e"),
    uIntensity: 0.6,
  },
  `
    varying vec3 vNormal;
    
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  `
    uniform vec3 uColor;
    uniform float uIntensity;
    
    varying vec3 vNormal;
    
    void main() {
      float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
      gl_FragColor = vec4(uColor, intensity * uIntensity);
    }
  `,
);

extend({ AtmosphereMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    atmosphereMaterial: React.JSX.IntrinsicElements["shaderMaterial"] & {
      uColor?: THREE.Color;
      uIntensity?: number;
    };
  }
}

export function GlobeAtmosphere({
  radius = 1,
  color = "#22c55e",
  intensity = 0.6,
}: GlobeAtmosphereProps) {
  const geometry = useMemo(
    () => new THREE.SphereGeometry(radius * 1.15, 64, 64),
    [radius],
  );

  // Dispose geometry on unmount or when radius changes
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const colorObj = useMemo(() => new THREE.Color(color), [color]);

  return (
    <mesh geometry={geometry}>
      <atmosphereMaterial
        transparent
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        uColor={colorObj}
        uIntensity={intensity}
      />
    </mesh>
  );
}
