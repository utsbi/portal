"use client";

import { shaderMaterial, useTexture } from "@react-three/drei";
import { extend, useFrame } from "@react-three/fiber";
import {
  forwardRef,
  Suspense,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";

export type GlobeStyle = "wireframe" | "dotted" | "earth";

const DEFAULT_SUN_DIRECTION = new THREE.Vector3(1, 0.2, 0.5).normalize();

export interface GlobeRef {
  group: THREE.Group | null;
}

interface GlobeProps {
  radius?: number;
  style?: GlobeStyle;
  autoRotate?: boolean;
  rotationSpeed?: number;
  initialRotation?: number;
  sunDirection?: THREE.Vector3;
  onClickBackground?: () => void;
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Wireframe style (unchanged)
// ---------------------------------------------------------------------------

const WireframeGlobeMaterial = shaderMaterial(
  {
    uColor: new THREE.Color("#22c55e"),
    uOpacity: 0.25,
    uGridSize: 12.0,
    uLineWidth: 0.015,
  },
  /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl */ `
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

// ---------------------------------------------------------------------------
// Dotted style (unchanged)
// ---------------------------------------------------------------------------

const DottedGlobeMaterial = shaderMaterial(
  {
    uColor: new THREE.Color("#22c55e"),
    uOpacity: 0.4,
    uDotSize: 40.0,
    uDotSpacing: 0.08,
  },
  /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl */ `
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

// ---------------------------------------------------------------------------
// Earth shader material — day/night, city lights, clouds, bump, atmosphere rim
// ---------------------------------------------------------------------------

const EarthSurfaceMaterial = shaderMaterial(
  {
    uDayTexture: null as THREE.Texture | null,
    uNightTexture: null as THREE.Texture | null,
    uBumpTexture: null as THREE.Texture | null,
    uCloudTexture: null as THREE.Texture | null,
    uSunDirection: new THREE.Vector3(1, 0.2, 0.5).normalize(),
    uAtmosphereDayColor: new THREE.Color("#4db2ff"),
    uAtmosphereTwilightColor: new THREE.Color("#bc490b"),
    uBumpStrength: 0.015,
    uCloudTime: 0.0,
  },
  // --- Vertex ---
  /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormalWorld;
    varying vec3 vPositionWorld;

    void main() {
      vUv = uv;
      vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vPositionWorld = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  // --- Fragment ---
  /* glsl */ `
    uniform sampler2D uDayTexture;
    uniform sampler2D uNightTexture;
    uniform sampler2D uBumpTexture;
    uniform sampler2D uCloudTexture;
    uniform vec3 uSunDirection;
    uniform vec3 uAtmosphereDayColor;
    uniform vec3 uAtmosphereTwilightColor;
    uniform float uBumpStrength;
    uniform float uCloudTime;

    varying vec2 vUv;
    varying vec3 vNormalWorld;
    varying vec3 vPositionWorld;

    float smoothRange(float value, float edge0, float edge1) {
      float t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
      return t * t * (3.0 - 2.0 * t);
    }

    vec3 perturbNormal(vec3 N) {
      vec2 texelSize = vec2(1.0) / vec2(textureSize(uBumpTexture, 0));
      float hL = texture2D(uBumpTexture, vUv + vec2(-texelSize.x, 0.0)).r;
      float hR = texture2D(uBumpTexture, vUv + vec2( texelSize.x, 0.0)).r;
      float hD = texture2D(uBumpTexture, vUv + vec2(0.0, -texelSize.y)).r;
      float hU = texture2D(uBumpTexture, vUv + vec2(0.0,  texelSize.y)).r;

      vec3 dPdx = dFdx(vPositionWorld);
      vec3 dPdy = dFdy(vPositionWorld);
      vec3 T = normalize(dPdx);
      vec3 B = normalize(cross(N, T));

      return normalize(N + (hL - hR) * uBumpStrength * T + (hD - hU) * uBumpStrength * B);
    }

    void main() {
      vec3 N = normalize(vNormalWorld);
      N = perturbNormal(N);

      vec3 sunDir = normalize(uSunDirection);

      // Sun orientation & day/night strength
      float sunOrientation = dot(N, sunDir);
      float dayStrength = smoothRange(sunOrientation, -0.25, 0.5);

      // Fresnel for atmospheric rim — use geometric normal to avoid bump noise on rim
      vec3 viewDir = normalize(vPositionWorld - cameraPosition);
      float fresnel = 1.0 - abs(dot(viewDir, normalize(vNormalWorld)));

      // Atmosphere overlay color
      vec3 atmosphereColor = mix(
        uAtmosphereTwilightColor,
        uAtmosphereDayColor,
        smoothRange(sunOrientation, -0.25, 0.75)
      );
      float atmosphereDayStrength = smoothRange(sunOrientation, -0.5, 1.0);
      float atmosphereMix = clamp(atmosphereDayStrength * pow(fresnel, 4.0) * 0.15, 0.0, 1.0);

      // Clouds (scrolling UV)
      vec2 cloudUv = vUv + vec2(uCloudTime, 0.0);
      float cloudsStrength = smoothstep(0.2, 1.0, texture2D(uCloudTexture, cloudUv).r);

      // Day surface: earth texture + cloud overlay
      vec3 dayColor = texture2D(uDayTexture, vUv).rgb;
      dayColor = mix(dayColor, vec3(1.0), cloudsStrength * 0.6);

      // Lambertian diffuse
      float diffuse = max(dot(N, sunDir), 0.0);
      vec3 litDay = dayColor * (0.12 + 0.88 * diffuse);

      // Night surface: city lights, dimmed by clouds, plus ambient terrain
      vec3 nightColor = texture2D(uNightTexture, vUv).rgb;
      nightColor *= (1.0 - cloudsStrength * 0.8);
      vec3 nightAmbient = texture2D(uDayTexture, vUv).rgb * 0.35;
      nightColor = max(nightColor, nightAmbient);

      // Blend day/night
      vec3 surfaceColor = mix(nightColor, litDay, dayStrength);

      // Apply atmosphere rim
      vec3 finalColor = mix(surfaceColor, atmosphereColor, atmosphereMix);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
);

extend({ WireframeGlobeMaterial, DottedGlobeMaterial, EarthSurfaceMaterial });

// ---------------------------------------------------------------------------
// Texture paths
// ---------------------------------------------------------------------------

const DAY_TEXTURE_URL = "/textures/earth_day.jpg";
const NIGHT_TEXTURE_URL = "/textures/8k_earth_nightmap.jpg";
const CLOUD_TEXTURE_URL = "/textures/8k_earth_clouds.jpg";
const BUMP_TEXTURE_URL = "/textures/earth_bump.jpg";

// ---------------------------------------------------------------------------
// R3F type augmentation
// ---------------------------------------------------------------------------

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
    earthSurfaceMaterial: React.JSX.IntrinsicElements["shaderMaterial"] & {
      uDayTexture?: THREE.Texture | null;
      uNightTexture?: THREE.Texture | null;
      uBumpTexture?: THREE.Texture | null;
      uCloudTexture?: THREE.Texture | null;
      uSunDirection?: THREE.Vector3;
      uAtmosphereDayColor?: THREE.Color;
      uAtmosphereTwilightColor?: THREE.Color;
      uBumpStrength?: number;
      uCloudTime?: number;
    };
  }
}

// ---------------------------------------------------------------------------
// Earth material component — loads 4 textures, animates cloud UV
// ---------------------------------------------------------------------------

function EarthMaterial({
  sunDirection,
  rotationSpeed = 0.001,
}: {
  sunDirection: THREE.Vector3;
  rotationSpeed?: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const [dayTex, nightTex, cloudTex, bumpTex] = useTexture(
    [DAY_TEXTURE_URL, NIGHT_TEXTURE_URL, CLOUD_TEXTURE_URL, BUMP_TEXTURE_URL],
    (textures) => {
      const [day, night, cloud, bump] = textures as THREE.Texture[];
      day.colorSpace = THREE.SRGBColorSpace;
      day.anisotropy = 8;
      night.colorSpace = THREE.SRGBColorSpace;
      night.anisotropy = 8;
      cloud.anisotropy = 4;
      cloud.wrapS = THREE.RepeatWrapping;
      bump.anisotropy = 4;
    },
  );

  // Gentle counterclockwise cloud drift
  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uCloudTime.value -= delta * 0.003;
    }
  });

  return (
    <earthSurfaceMaterial
      ref={materialRef}
      uDayTexture={dayTex}
      uNightTexture={nightTex}
      uCloudTexture={cloudTex}
      uBumpTexture={bumpTex}
      uSunDirection={sunDirection}
    />
  );
}

// ---------------------------------------------------------------------------
// Globe component
// ---------------------------------------------------------------------------

export const Globe = forwardRef<GlobeRef, GlobeProps>(function Globe(
  {
    radius = 1,
    style = "earth",
    autoRotate = true,
    rotationSpeed = 0.001,
    initialRotation = 0,
    sunDirection = DEFAULT_SUN_DIRECTION,
    onClickBackground,
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
        return <EarthMaterial sunDirection={sunDirection} rotationSpeed={rotationSpeed} />;
    }
  };

  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        <mesh geometry={geometry} onClick={onClickBackground}>{renderMaterial()}</mesh>
      </Suspense>
      {children}
    </group>
  );
});
