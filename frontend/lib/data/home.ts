import { Compass, Layers, Target } from "lucide-react";
import type { Department } from "@/components/department-item";
import type { StrategyItem } from "@/components/strategy-card";

export const FORMS_LINK = "https://forms.gle/KWJjaXGYt2dv3bY68";

export interface Stat {
  value: number;
  label: string;
  prefix: string;
  suffix: string;
  description: string;
}

export const stats: Stat[] = [
  {
    value: 210,
    label: "Project Portfolio",
    prefix: "$",
    suffix: "M+",
    description:
      "Professional-grade sustainable solutions delivered across diverse project scopes.",
  },
  {
    value: 50,
    label: "Student Members",
    prefix: "",
    suffix: "+",
    description:
      "Multidisciplinary talents from engineering, business, and technology converging as one consultancy.",
  },
  {
    value: 1500,
    label: "Hours Contributed",
    prefix: "",
    suffix: "+",
    description:
      "Expertise dedicated to innovative designs serving our community.",
  },
];

export const strategy: StrategyItem[] = [
  {
    num: "01",
    title: "Identify",
    subtitle: "the Opportunity",
    description:
      "We assess infrastructure challenges to find opportunities where sustainable design can deliver the greatest impact for our clients and community.",
    icon: Target,
  },
  {
    num: "02",
    title: "Architect",
    subtitle: "the Solution",
    description:
      "Our teams fuse client vision with cutting-edge, sustainable practices to design practical, personalized solutions.",
    icon: Compass,
  },
  {
    num: "03",
    title: "Execute",
    subtitle: "with Precision",
    description:
      "We take a hands-on approach to implementation, delivering projects on time and to the highest professional standard.",
    icon: Layers,
  },
];

export const departments: Department[] = [
  {
    name: "Engineering",
    description: [
      "Structural analysis and load-bearing system design for resilient infrastructure",
      "MEP systems integration ensuring optimal energy performance",
      "Sustainable infrastructure planning with lifecycle assessment",
    ],
  },
  {
    name: "Architecture",
    description: [
      "Conceptual design and creative direction from vision to blueprint",
      "3D modeling and immersive visualization for client presentations",
      "Spatial planning that balances function, aesthetics, and sustainability",
    ],
  },
  {
    name: "Business",
    description: [
      "Project management from inception through delivery and handoff",
      "Client relations and stakeholder communication across all phases",
      "Strategic planning aligned with growth and sustainability targets",
    ],
  },
  {
    name: "Legal",
    description: [
      "Contract negotiation and documentation for complex builds",
      "Zoning compliance and regulatory navigation across jurisdictions",
      "Translation of legal documentation for cross-departamental use",
      "Internal relations, client-preparadness and conflict mitigation",
    ],
  },
  {
    name: "Technology",
    description: [
      "Building information modeling for coordinated design workflows",
      "Energy simulations and performance benchmarking tools",
      "Digital infrastructure supporting collaboration and data integrity",
    ],
  },
  {
    name: "Research & Development",
    description: [
      "Material science research for next-generation building solutions",
      "Sustainability metrics and environmental impact quantification",
      "Innovation labs prototyping emerging construction technologies",
    ],
  },
  {
    name: "Public Relations",
    description: [
      "Community engagement and public-facing project communication",
      "Outreach programs connecting industry partners and stakeholders",
      "Partnership development to advance shared sustainability goals",
    ],
  },
];
