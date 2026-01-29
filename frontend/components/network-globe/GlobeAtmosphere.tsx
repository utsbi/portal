"use client";

import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

const DEFAULT_SUN_DIRECTION = new THREE.Vector3(1, 0.2, 0.5).normalize();

interface GlobeAtmosphereProps {
  radius?: number;
  sunDirection?: THREE.Vector3;
  atmosphereDayColor?: string;
  atmosphereTwilightColor?: string;
}

const EarthAtmosphereMaterial = shaderMaterial(
  {
    uSunDirection: new THREE.Vector3(1, 0.2, 0.5).normalize(),
    uAtmosphereDayColor: new THREE.Color("#4db2ff"),
    uAtmosphereTwilightColor: new THREE.Color("#bc490b"),
  },
  /* glsl */ `
    varying vec3 vNormalWorld;
    varying vec3 vPositionWorld;

    void main() {
      vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vPositionWorld = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  /* glsl */ `
    uniform vec3 uSunDirection;
    uniform vec3 uAtmosphereDayColor;
    uniform vec3 uAtmosphereTwilightColor;

    varying vec3 vNormalWorld;
    varying vec3 vPositionWorld;

    float smoothRange(float value, float edge0, float edge1) {
      float t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
      return t * t * (3.0 - 2.0 * t);
    }

    void main() {
      vec3 N = normalize(vNormalWorld);
      vec3 viewDir = normalize(cameraPosition - vPositionWorld);
      float edgeFactor = dot(viewDir, N);

      // Glow strongest at rim (edgeFactor → 0), invisible face-on (edgeFactor → 1)
      float alpha = pow(clamp(1.0 - edgeFactor, 0.0, 1.0), 5.0) * 0.35;

      float sunOrientation = dot(N, normalize(uSunDirection));

      // Blend between twilight (orange) and day (blue)
      vec3 atmosphereColor = mix(
        uAtmosphereTwilightColor,
        uAtmosphereDayColor,
        smoothRange(sunOrientation, -0.25, 0.75)
      );

      // Stronger glow on the sun-facing side
      alpha *= smoothRange(sunOrientation, -0.5, 1.0);

      gl_FragColor = vec4(atmosphereColor, alpha);
    }
  `,
);

extend({ EarthAtmosphereMaterial });

declare module "@react-three/fiber" {
  interface ThreeElements {
    earthAtmosphereMaterial: React.JSX.IntrinsicElements["shaderMaterial"] & {
      uSunDirection?: THREE.Vector3;
      uAtmosphereDayColor?: THREE.Color;
      uAtmosphereTwilightColor?: THREE.Color;
    };
  }
}

export function GlobeAtmosphere({
  radius = 1,
  sunDirection = DEFAULT_SUN_DIRECTION,
  atmosphereDayColor = "#4db2ff",
  atmosphereTwilightColor = "#bc490b",
}: GlobeAtmosphereProps) {
  const geometry = useMemo(
    () => new THREE.SphereGeometry(radius * 1.04, 64, 64),
    [radius],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const dayColor = useMemo(
    () => new THREE.Color(atmosphereDayColor),
    [atmosphereDayColor],
  );
  const twilightColor = useMemo(
    () => new THREE.Color(atmosphereTwilightColor),
    [atmosphereTwilightColor],
  );

  return (
    <mesh geometry={geometry}>
      <earthAtmosphereMaterial
        transparent
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        uSunDirection={sunDirection}
        uAtmosphereDayColor={dayColor}
        uAtmosphereTwilightColor={twilightColor}
      />
    </mesh>
  );
}
