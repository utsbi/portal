"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { motion } from "motion/react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ConnectionArcs } from "./ConnectionArcs";
import {
  ALL_LOCATIONS,
  CATEGORY_LABELS,
  HUB_LOCATION,
  type Location,
  PARTNER_LOCATIONS,
} from "./data/locations";
import { Globe } from "./Globe";
import { GlobeAtmosphere } from "./GlobeAtmosphere";
import { LocationMarkers } from "./LocationMarker";
import { Stars } from "./Stars";

interface NetworkGlobeProps {
  className?: string;
  onLocationHover?: (location: Location | null) => void;
}

const GLOBE_RADIUS = 1;
const AUTO_ROTATE_RESUME_DELAY_MS = 10000;

// Offset the camera view to position globe in bottom-right
function CameraViewOffset() {
  const { camera, size } = useThree();

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      // Offset: negative X shifts view right, negative Y shifts view down
      const offsetX = -size.width * 0.25; // Shift right by 25%
      const offsetY = size.height * -0.15; // Shift down by 15%

      camera.setViewOffset(
        size.width,
        size.height,
        offsetX,
        offsetY,
        size.width,
        size.height
      );
      camera.updateProjectionMatrix();
    }

    return () => {
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
      }
    };
  }, [camera, size]);

  return null;
}

function GlobeScene({
  onHover,
}: {
  onHover: (location: Location | null) => void;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInteractionStart = useCallback(() => {
    setAutoRotate(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleInteractionEnd = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setAutoRotate(true);
    }, AUTO_ROTATE_RESUME_DELAY_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Static sun direction — lit side faces roughly toward the camera
  const sunDirection = useMemo(
    () => new THREE.Vector3(1, 0.2, 0.5).normalize(),
    [],
  );

  return (
    <>
      {/* Offset camera view to position globe bottom-right */}
      <CameraViewOffset />

      {/* Stars background */}
      <Stars count={2000} radius={25} />

      {/* Globe at origin - view offset handles screen positioning */}
      <group position={[0, 0, 0]}>
        <Globe
          radius={GLOBE_RADIUS}
          style="earth"
          autoRotate={autoRotate}
          rotationSpeed={0.0006}
          initialRotation={0.15}
          sunDirection={sunDirection}
        >
          <LocationMarkers
            locations={ALL_LOCATIONS}
            globeRadius={GLOBE_RADIUS}
            onHover={onHover}
          />
          <ConnectionArcs
            hub={HUB_LOCATION}
            destinations={PARTNER_LOCATIONS}
            globeRadius={GLOBE_RADIUS}
          />
        </Globe>
        <GlobeAtmosphere
          radius={GLOBE_RADIUS}
          sunDirection={sunDirection}
        />
      </group>

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        minDistance={1.3}
        maxDistance={2.2}
        minPolarAngle={Math.PI * 0.25}
        maxPolarAngle={Math.PI * 0.75}
        rotateSpeed={0.4}
        target={[0, 0, 0]}
        onStart={handleInteractionStart}
        onEnd={handleInteractionEnd}
      />
    </>
  );
}

function LoadingFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-2 border-sbi-green/20 border-t-sbi-green rounded-full animate-spin" />
        <div className="text-sbi-muted text-sm tracking-wider uppercase">
          Loading Globe...
        </div>
      </div>
    </div>
  );
}

interface FloatingInfoPanelProps {
  hoveredLocation: Location | null;
}

function FloatingInfoPanel({ hoveredLocation }: FloatingInfoPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="absolute left-8 md:left-16 top-1/2 -translate-y-1/2 z-20 max-w-sm"
    >
      {/* Main content card */}
      <div className="relative">
        {/* Decorative line */}
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: "100%" }}
          transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute -left-6 top-0 w-px bg-gradient-to-b from-transparent via-sbi-green/50 to-transparent"
        />

        {/* Section label */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-px bg-sbi-green" />
          <span className="text-[10px] tracking-[0.3em] uppercase text-sbi-green font-medium">
            Network
          </span>
        </div>

        {/* Title */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-light tracking-tight text-white mb-4">
          Our Growing
          <br />
          <span className="italic text-sbi-green">Network</span>
        </h2>

        {/* Description */}
        <p className="text-sm md:text-base text-sbi-muted leading-relaxed mb-8 max-w-xs">
          Connecting with institutions worldwide to advance sustainable building
          education.
        </p>

        {/* Location info or instructions */}
        <div className="relative">
          <div className="absolute -left-3 top-0 bottom-0 w-px bg-sbi-dark-border" />

          {hoveredLocation ? (
            <motion.div
              key={hoveredLocation.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="pl-4"
            >
              <div className="text-[10px] tracking-[0.2em] uppercase text-sbi-green mb-2">
                {CATEGORY_LABELS[hoveredLocation.category]}
              </div>
              <div className="text-lg md:text-xl font-light text-white mb-1">
                {hoveredLocation.name}
              </div>
              {hoveredLocation.description && (
                <div className="text-sm text-sbi-muted">
                  {hoveredLocation.description}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="pl-4 text-sbi-muted-dark text-sm">
              <p className="mb-2">Hover over a location to explore.</p>
              <p className="text-xs opacity-60">
                Drag to rotate • Scroll to zoom
              </p>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="flex gap-8 mt-10 pt-6 border-t border-sbi-dark-border">
          <div>
            <div className="text-2xl font-light text-white">13</div>
            <div className="text-[10px] tracking-wider uppercase text-sbi-muted">
              Locations
            </div>
          </div>
          <div>
            <div className="text-2xl font-light text-white">5</div>
            <div className="text-[10px] tracking-wider uppercase text-sbi-muted">
              Countries
            </div>
          </div>
          <div>
            <div className="text-2xl font-light text-white">3</div>
            <div className="text-[10px] tracking-wider uppercase text-sbi-muted">
              Continents
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function NetworkGlobe({
  className = "",
  onLocationHover,
}: NetworkGlobeProps) {
  const [hoveredLocation, setHoveredLocation] = useState<Location | null>(null);

  const handleHover = useCallback(
    (location: Location | null) => {
      setHoveredLocation(location);
      onLocationHover?.(location);
    },
    [onLocationHover],
  );

  return (
    <div
      className={`relative w-full h-full min-h-[80vh] md:min-h-screen bg-sbi-dark ${className}`}
    >
      {/* Subtle gradient overlay - lighter to preserve arc/marker visibility */}
      <div className="absolute inset-0 bg-linear-to-r from-sbi-dark/90 via-sbi-dark/40 to-transparent z-10 pointer-events-none" />

      {/* Mouse interaction blocker - left 1/3 of screen */}
      <div className="absolute inset-y-0 left-0 w-1/3 z-15 pointer-events-auto" />

      {/* Floating info panel - left side */}
      <FloatingInfoPanel hoveredLocation={hoveredLocation} />

      {/* Globe canvas - full viewport */}
      <div className="absolute inset-0">
        <Suspense fallback={<LoadingFallback />}>
          <Canvas
            camera={{
              // Azimuth: 21°, Polar: 67°, Distance: 2.20
              position: [0.73, 0.86, 1.89],
              fov: 50,
            }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true }}
            style={{ background: "transparent" }}
          >
            <GlobeScene onHover={handleHover} />
          </Canvas>
        </Suspense>
      </div>

      {/* Mobile info panel - bottom */}
      <div className="md:hidden absolute bottom-6 left-4 right-4 z-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-sbi-dark/90 backdrop-blur-xl border border-sbi-dark-border p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-px bg-sbi-green" />
            <span className="text-[10px] tracking-[0.2em] uppercase text-sbi-green">
              Network
            </span>
          </div>
          {hoveredLocation ? (
            <div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-sbi-green/70 mb-1">
                {CATEGORY_LABELS[hoveredLocation.category]}
              </div>
              <div className="text-base font-light text-white">
                {hoveredLocation.name}
              </div>
            </div>
          ) : (
            <div className="text-sm text-sbi-muted">
              Tap a location to explore our global network.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
