import { Vector3 } from "three";

export function latLngToVector3(
  lat: number,
  lng: number,
  radius: number = 1,
): Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  return new Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export function createArcPoints(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  radius: number,
  segments: number = 50,
  arcHeight: number = 0.2,
): Vector3[] {
  const start = latLngToVector3(startLat, startLng, radius);
  const end = latLngToVector3(endLat, endLng, radius);
  const points: Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = new Vector3().lerpVectors(start, end, t);
    p.normalize();
    const heightMultiplier = 1 + arcHeight * Math.sin(Math.PI * t);
    p.multiplyScalar(radius * heightMultiplier);
    points.push(p);
  }

  return points;
}

export function calculateArcHeight(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): number {
  const start = latLngToVector3(startLat, startLng, 1);
  const end = latLngToVector3(endLat, endLng, 1);
  const distance = start.distanceTo(end);
  return Math.min(0.5, Math.max(0.1, distance * 0.3));
}
