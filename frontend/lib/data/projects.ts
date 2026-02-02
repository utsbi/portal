import type { StaticImageData } from "next/image";
import ex1 from "@/assets/images/project-one/exterior-concept/EXTERIOR-1.webp";
import ex2 from "@/assets/images/project-one/exterior-concept/EXTERIOR-2.webp";
import in1 from "@/assets/images/project-one/interior-concept/INTERIOR-1.webp";
import in2 from "@/assets/images/project-one/interior-concept/INTERIOR-2.webp";
import in3 from "@/assets/images/project-one/interior-concept/INTERIOR-3.webp";
import in4 from "@/assets/images/project-one/interior-concept/INTERIOR-4.webp";
import site1 from "@/assets/images/project-one/site-view/SITE-1.webp";
import site2 from "@/assets/images/project-one/site-view/SITE-2.webp";
import site3 from "@/assets/images/project-one/site-view/SITE-3.webp";
import site4 from "@/assets/images/project-one/site-view/SITE-4.webp";
import pe1 from "@/assets/images/project-two/exterior-concept/1.webp";
import pe2 from "@/assets/images/project-two/exterior-concept/2.webp";
import pe3 from "@/assets/images/project-two/exterior-concept/3.webp";
import pe4 from "@/assets/images/project-two/exterior-concept/4.webp";
import pi1 from "@/assets/images/project-two/interior-concept/1.webp";
import pi2 from "@/assets/images/project-two/interior-concept/2.webp";
import pi3 from "@/assets/images/project-two/interior-concept/3.webp";
import pi4 from "@/assets/images/project-two/interior-concept/4.webp";
import dc0 from "@/assets/images/data-center/img-000.png";
import dc1 from "@/assets/images/data-center/img-001.png";
import dc2 from "@/assets/images/data-center/img-002.png";
import dc3 from "@/assets/images/data-center/img-003.png";
import dc4 from "@/assets/images/data-center/img-004.png";
import hr1 from "@/assets/images/high-rise/001.png";
import hr2 from "@/assets/images/high-rise/002.png";
import hr3 from "@/assets/images/high-rise/003.png";
import hr4 from "@/assets/images/high-rise/004.png";

export interface CameraPreset {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  embeddedIndex?: number;
}

export interface CameraConfig {
  position: [number, number, number];
  target: [number, number, number];
}

export interface CameraLimits {
  minDistance: number;
  maxDistance: number;
}

export interface Project {
  slug: string;
  title: string;
  description: string;
  status: "completed" | "in-progress" | "concept";
  tags: string[];
  coverImage: StaticImageData;
  modelUrl?: string;
  has3D: boolean;
  cameraPresets: CameraPreset[] | null;
  defaultCamera?: CameraConfig;
  cameraLimits?: CameraLimits;
  modelScale?: number;
  videoUrl?: string;
  galleryImages: StaticImageData[];
}

export const projects: Project[] = [
  {
    slug: "sustainable-family-home",
    title: "Sustainable Family Home",
    description:
      "A modern farmhouse concept designed for sustainable family living. This 2-bedroom, 2-bathroom home features a spacious layout, including a large garage and patio, that thoughtfully integrates classic design with modern, eco-friendly efficiencies and materials.",
    status: "completed",
    tags: ["Residential", "Modern Farmhouse", "2BR/2BA", "Eco-Friendly"],
    coverImage: pe1,
    modelUrl: "/models/family_home.glb",
    has3D: true,
    defaultCamera: {
      position: [6.5, 615, 1015],
      target: [0, 0, 0],
    },
    cameraLimits: {
      minDistance: 50,
      maxDistance: 1500,
    },
    cameraPresets: [
      {
        id: "living-1",
        label: "Living Room 1",
        position: [0, 0, 0],
        target: [0, 0, 0],
        embeddedIndex: 0,
      },
      {
        id: "living-2",
        label: "Living Room 2",
        position: [0, 0, 0],
        target: [0, 0, 0],
        embeddedIndex: 1,
      },
      {
        id: "living-3",
        label: "Living Room 3",
        position: [0, 0, 0],
        target: [0, 0, 0],
        embeddedIndex: 2,
      },
      {
        id: "bedroom-1",
        label: "Bedroom 1",
        position: [0, 0, 0],
        target: [0, 0, 0],
        embeddedIndex: 3,
      },
      {
        id: "bedroom-2",
        label: "Bedroom 2",
        position: [0, 0, 0],
        target: [0, 0, 0],
        embeddedIndex: 4,
      },
      {
        id: "theater",
        label: "Theater Room",
        position: [0, 0, 0],
        target: [0, 0, 0],
        embeddedIndex: 5,
      },
      {
        id: "garage",
        label: "Garage",
        position: [0, 0, 0],
        target: [0, 0, 0],
        embeddedIndex: 6,
      },
      {
        id: "office",
        label: "Office",
        position: [0, 0, 0],
        target: [0, 0, 0],
        embeddedIndex: 7,
      },
    ],
    galleryImages: [pe1, pe2, pe3, pe4, pi1, pi2, pi3, pi4],
  },
  {
    slug: "hobbie-farm",
    title: "Hobbie Farm Project",
    description:
      "A small, space-efficient housing concept designed as a foundation for sustainable living. This prototype serves as a starting point, with plans to integrate eco-friendly features and innovations during the building process.",
    status: "completed",
    tags: ["Prototype", "Space-Efficient", "Sustainable Tech"],
    coverImage: ex1,
    modelUrl: "/models/hobbie_farm.glb",
    has3D: true,
    defaultCamera: {
      position: [60, 40, 70],
      target: [0, 10, 0],
    },
    cameraLimits: {
      minDistance: 5,
      maxDistance: 150,
    },
    modelScale: 250,
    cameraPresets: [
      {
        id: "exterior-front",
        label: "Front View",
        position: [1, 15, 80],
        target: [0, 10, 0],
      },
      {
        id: "exterior-side",
        label: "Side View",
        position: [80, 25, 0],
        target: [0, 10, 0],
      },
      {
        id: "exterior-aerial",
        label: "Aerial View",
        position: [40, 80, 60],
        target: [0, 0, 0],
      },
      {
        id: "interior",
        label: "Interior View",
        position: [6.24, 13.84, 8.53],
        target: [0, 10, 0],
      },
    ],
    galleryImages: [ex1, ex2, in1, in2, in3, in4, site1, site2, site3, site4],
  },
  {
    slug: "regis-energy-data-center-project",
    title: "Regis Energy Data Center",
    description: "A master site plan and phase development for a massive 1 GW-capable data center campus in Laredo, Texas. This project encompasses five compute halls across a sprawling campus, with Phase 1 design focused on delivering 320 MW of utility load through the integration of four compute halls, supporting infrastructure for power distribution, cooling systems, and site logistics.",
    status: "completed",
    tags: ["Commercial", "Data Center", "Infrastructure", "1 GW Campus"],
    coverImage: dc0,
    has3D: false,
    cameraPresets: null,
    galleryImages: [dc0, dc1, dc2, dc3, dc4],
  },
  {
    slug: "high-rise-tower",
    title: "Houston Museum District High-Rise Tower",
    description: "A mixed-use high-rise tower concept situated in Houston's Museum District, designed to explore vertical density and sustainable urban living. This project features a bold structural form that balances commercial and residential programming while prioritizing energy efficiency and occupant comfort at scale.",
    status: "completed",
    tags: ["Commercial", "High-Rise", "Urban", "Mixed-Use"],
    coverImage: hr1,
    modelUrl: "/models/high_rise.glb",
    has3D: true,
    defaultCamera: {
      position: [120, 80, -130],
      target: [24, 40, -234],
    },
    cameraLimits: {
      minDistance: 30,
      maxDistance: 150,
    },
    cameraPresets: null,
    videoUrl: "https://www.youtube.com/watch?v=uuex1wIOf8Y",
    galleryImages: [hr1, hr2, hr3, hr4],
  },
];
