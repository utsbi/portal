export type LocationCategory =
  | "hub"
  | "high-school"
  | "planned-network"
  | "college-network";

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: LocationCategory;
  description?: string;
}

// Hub location - all connections radiate from here
export const HUB_LOCATION: Location = {
  id: "ut-austin",
  name: "The University of Texas at Austin",
  lat: 30.2850284,
  lng: -97.7335226,
  category: "hub",
  description: "SBI Headquarters",
};

// Partner locations extracted from Google Maps
export const PARTNER_LOCATIONS: Location[] = [
  // High School Outreach
  {
    id: "american-school-doha",
    name: "American School of Doha",
    lat: 25.2628581,
    lng: 51.4815018,
    category: "high-school",
    description: "Qatar - High School Outreach",
  },
  {
    id: "taylor-high-school",
    name: "James E. Taylor High School",
    lat: 29.7765191,
    lng: -95.7312123,
    category: "high-school",
    description: "Houston Area - High School Outreach",
  },
  {
    id: "martin-high-school",
    name: "James Martin High School",
    lat: 32.684543,
    lng: -97.1800358,
    category: "high-school",
    description: "Arlington - High School Outreach",
  },
  {
    id: "arlington-ctc",
    name: "Arlington ISD Dan Dipert Career and Technical Center",
    lat: 32.7102034,
    lng: -97.0836849,
    category: "high-school",
    description: "Arlington - High School Outreach",
  },
  {
    id: "oxford-japan",
    name: "University of Oxford Japan",
    lat: 35.6908587,
    lng: 139.744851,
    category: "high-school",
    description: "Tokyo - High School Outreach",
  },

  // Planned Network (Universities we plan to network with)
  {
    id: "ut-arlington",
    name: "The University of Texas at Arlington",
    lat: 32.7292117,
    lng: -97.1151971,
    category: "planned-network",
    description: "Planned Network",
  },
  {
    id: "university-dallas",
    name: "University of Dallas",
    lat: 32.8462507,
    lng: -96.9196041,
    category: "planned-network",
    description: "Planned Network",
  },
  {
    id: "purdue",
    name: "Purdue University",
    lat: 40.4237054,
    lng: -86.9211946,
    category: "planned-network",
    description: "Indiana - Planned Network",
  },
  {
    id: "weill-cornell-qatar",
    name: "Weill Cornell Medicine - Qatar",
    lat: 25.3181489,
    lng: 51.4402306,
    category: "planned-network",
    description: "Qatar - Planned Network",
  },
  {
    id: "university-houston",
    name: "University of Houston",
    lat: 29.7204627,
    lng: -95.3429319,
    category: "planned-network",
    description: "Houston - Planned Network",
  },

  // College Network (Active partnerships)
  {
    id: "rice",
    name: "Rice University",
    lat: 29.7168363,
    lng: -95.4035531,
    category: "college-network",
    description: "Houston - College Network",
  },
  {
    id: "texas-am",
    name: "Texas A&M University",
    lat: 30.6066091,
    lng: -96.3568404,
    category: "college-network",
    description: "College Station - College Network",
  },
  {
    id: "imperial-college",
    name: "Imperial College London",
    lat: 51.4988222,
    lng: -0.1748735,
    category: "college-network",
    description: "UK - College Network",
  },
];

// All locations combined
export const ALL_LOCATIONS: Location[] = [HUB_LOCATION, ...PARTNER_LOCATIONS];

// Category colors (using sbi-green with variations)
export const CATEGORY_COLORS: Record<LocationCategory, string> = {
  hub: "#22c55e", // sbi-green - bright
  "high-school": "#22c55e", // sbi-green
  "planned-network": "#16a34a", // slightly darker green
  "college-network": "#4ade80", // lighter green
};

// Category labels for UI
export const CATEGORY_LABELS: Record<LocationCategory, string> = {
  hub: "SBI Headquarters",
  "high-school": "High School Outreach",
  "planned-network": "Planned Network",
  "college-network": "College Network",
};
