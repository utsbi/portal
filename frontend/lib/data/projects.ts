import type { StaticImageData } from "next/image";
import ex1 from "@/assets/images/project-one/exterior-concept/EXTERIOR-1.webp";
import ex2 from "@/assets/images/project-one/exterior-concept/EXTERIOR-2.webp";
import site1 from "@/assets/images/project-one/site-view/SITE-1.webp";
import pe1 from "@/assets/images/project-two/exterior-concept/1.webp";
import pe2 from "@/assets/images/project-two/exterior-concept/2.webp";
import pe3 from "@/assets/images/project-two/exterior-concept/3.webp";
import pe4 from "@/assets/images/project-two/exterior-concept/4.webp";

export interface CameraPreset {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
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
    cameraPresets: null,
    galleryImages: [pe1, pe2, pe3, pe4],
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
    cameraPresets: [
      {
        id: "exterior-front",
        label: "Front View",
        position: [50, 30, 80],
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
    ],
    galleryImages: [ex1, ex2, site1],
  },
];
