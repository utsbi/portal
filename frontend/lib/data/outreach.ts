export interface Stat {
  value: number;
  label: string;
  suffix: string;
  description: string;
}

export const stats: Stat[] = [
  {
    value: 5,
    label: "Schools Reached",
    suffix: "+",
    description: "High schools and universities in our growing network.",
  },
  {
    value: 200,
    label: "Students Impacted",
    suffix: "+",
    description: "Future leaders introduced to sustainable building practices.",
  },
  {
    value: 6,
    label: "Active Partnerships",
    suffix: "",
    description: "Organizations collaborating on sustainability initiatives.",
  },
];
