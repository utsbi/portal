"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Line2 } from "three-stdlib";
import type { Location } from "./data/locations";
import { CATEGORY_COLORS } from "./data/locations";
import { calculateArcHeight, createArcPoints } from "./utils/coordinates";

interface ConnectionArcProps {
  from: Location;
  to: Location;
  globeRadius: number;
  animationDelay?: number;
}

function ConnectionArc({
  from,
  to,
  globeRadius,
  animationDelay = 0,
}: ConnectionArcProps) {
  const lineRef = useRef<Line2>(null);
  const dashOffsetRef = useRef(0);

  const arcHeight = useMemo(
    () => calculateArcHeight(from.lat, from.lng, to.lat, to.lng),
    [from, to],
  );

  const points = useMemo(
    () =>
      createArcPoints(
        from.lat,
        from.lng,
        to.lat,
        to.lng,
        globeRadius,
        50,
        arcHeight * 0.8, // Reduce arc height by 20%
      ),
    [from, to, globeRadius, arcHeight],
  );

  const color = CATEGORY_COLORS[to.category];

  useFrame((state) => {
    dashOffsetRef.current =
      (state.clock.elapsedTime * 0.5 + animationDelay) % 1;
    if (lineRef.current?.material) {
      const material = lineRef.current.material;
      if ("dashOffset" in material) {
        (material as { dashOffset: number }).dashOffset =
          -dashOffsetRef.current * 2;
      }
    }
  });

  return (
    <Line
      ref={lineRef}
      points={points}
      color={color}
      lineWidth={1.0}
      transparent
      opacity={0.75}
      dashed
      dashScale={40}
      dashSize={0.5}
      gapSize={0.5}
    />
  );
}

interface ConnectionArcsProps {
  hub: Location;
  destinations: Location[];
  globeRadius: number;
}

export function ConnectionArcs({
  hub,
  destinations,
  globeRadius,
}: ConnectionArcsProps) {
  return (
    <group>
      {destinations.map((destination, index) => (
        <ConnectionArc
          key={destination.id}
          from={hub}
          to={destination}
          globeRadius={globeRadius}
          animationDelay={index * 0.1}
        />
      ))}
    </group>
  );
}
