"use client";

import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Location } from "./data/locations";
import { CATEGORY_COLORS } from "./data/locations";
import { latLngToVector3 } from "./utils/coordinates";

// Reusable vectors for calculations (avoid allocations in useFrame)
const UP_VECTOR = new THREE.Vector3(0, 0, 1);
const tempVec = new THREE.Vector3();
const tempNormal = new THREE.Vector3();
const tempToCamera = new THREE.Vector3();

interface LocationMarkerProps {
  location: Location;
  globeRadius: number;
  onHover?: (location: Location | null) => void;
  onSelect?: (location: Location) => void;
  selected?: boolean;
  isHub?: boolean;
}

export function LocationMarker({
  location,
  globeRadius,
  onHover,
  onSelect,
  selected = false,
  isHub = false,
}: LocationMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(true);
  const { camera } = useThree();

  const position = useMemo(
    () => latLngToVector3(location.lat, location.lng, globeRadius),
    [location.lat, location.lng, globeRadius],
  );

  // Calculate quaternion to orient marker flat on sphere surface
  const orientation = useMemo(() => {
    const normal = position.clone().normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(UP_VECTOR, normal);
    return quaternion;
  }, [position]);

  const color = CATEGORY_COLORS[location.category];
  // Very small markers to avoid overlap
  const baseSize = isHub ? 0.004 : 0.0018;
  const isActive = hovered || selected;
  const markerSize = isActive ? baseSize * 1.5 : baseSize;

  // Reset cursor style on unmount if still hovered
  useEffect(() => {
    return () => {
      if (hovered) {
        document.body.style.cursor = "auto";
      }
    };
  }, [hovered]);

  // Store the hub ring base scale for animation
  const hubRingBaseScale = baseSize * 1.8;

  useFrame((state) => {
    // Check if marker is facing camera (backface culling)
    if (groupRef.current) {
      groupRef.current.getWorldPosition(tempVec);
      // Reuse vectors instead of allocating new ones
      tempNormal.copy(tempVec).normalize();
      tempToCamera.copy(camera.position).sub(tempVec).normalize();
      const dot = tempNormal.dot(tempToCamera);
      // Hide if facing away from camera (dot product < threshold)
      setVisible(dot > 0.1);
    }

    if (outerRingRef.current && isHub && visible) {
      // Pulse between 1.0x and 1.4x the base scale (use clock instead of Date.now)
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.2 + 1.2;
      outerRingRef.current.scale.setScalar(hubRingBaseScale * pulse);
      const material = outerRingRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.5 * (1.4 - pulse);
    }
  });

  const handlePointerOver = () => {
    setHovered(true);
    onHover?.(location);
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    // Only reset cursor if we're still the hovered marker
    // This prevents race conditions when quickly moving between markers
    if (hovered) {
      document.body.style.cursor = "auto";
    }
    setHovered(false);
    onHover?.(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect?.(location);
  };

  // Don't render if facing away from camera
  if (!visible) {
    return <group ref={groupRef} position={position} quaternion={orientation} />;
  }

  return (
    <group
      ref={groupRef}
      position={position}
      quaternion={orientation}
      renderOrder={hovered ? 100 : isHub ? 50 : 10}
    >
      {/* Visible marker with pointer events */}
      <mesh
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        scale={markerSize}
        renderOrder={isActive ? 101 : isHub ? 51 : 11}
      >
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isActive ? 1 : 0.95}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>

      {isActive && (
        <mesh scale={markerSize * 1.6} renderOrder={102}>
          <ringGeometry args={[0.6, 1, 24]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>
      )}

      {isHub && (
        <mesh ref={outerRingRef} scale={hubRingBaseScale} renderOrder={52}>
          <ringGeometry args={[0.6, 1, 24]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}

interface LocationMarkersProps {
  locations: Location[];
  globeRadius: number;
  onHover?: (location: Location | null) => void;
  onSelect?: (location: Location) => void;
  selectedId?: string;
}

export function LocationMarkers({
  locations,
  globeRadius,
  onHover,
  onSelect,
  selectedId,
}: LocationMarkersProps) {
  return (
    <group>
      {locations.map((location) => (
        <LocationMarker
          key={location.id}
          location={location}
          globeRadius={globeRadius * 1.008}
          onHover={onHover}
          onSelect={onSelect}
          selected={selectedId === location.id}
          isHub={location.category === "hub"}
        />
      ))}
    </group>
  );
}
