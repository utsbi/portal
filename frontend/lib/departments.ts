// Canonical department list shared across Reports + Requests.
// Values are Title Case so they read identically in DB rows and table cells —
// no value/label divergence.

export interface DepartmentOption {
  value: string;
  label: string;
}

export const DEPARTMENTS: DepartmentOption[] = [
  { value: "Architecture", label: "Architecture" },
  { value: "Engineering — General", label: "Engineering — General" },
  { value: "Engineering — Civil", label: "Engineering — Civil" },
  {
    value: "Engineering — Environmental",
    label: "Engineering — Environmental",
  },
  { value: "Engineering — Structural", label: "Engineering — Structural" },
  { value: "Engineering — Electrical", label: "Engineering — Electrical" },
  { value: "Finance", label: "Finance" },
  { value: "Public Relations", label: "Public Relations" },
  { value: "Marketing", label: "Marketing" },
  { value: "Internal Technologies", label: "Internal Technologies" },
  { value: "Legal", label: "Legal" },
  { value: "R&D", label: "R&D" },
];

// Pretty up legacy lowercase / short-form values stored before the canonical
// list landed. Returns the original value if no mapping is known so unknowns
// just pass through.
const LEGACY_TO_CANONICAL: Record<string, string> = {
  "n/a": "—",
  engineering: "Engineering — General",
  architecture: "Architecture",
  tech: "Internal Technologies",
  business: "Finance",
  pr: "Public Relations",
  research: "R&D",
  legal: "Legal",
  finance: "Finance",
  marketing: "Marketing",
};

export function departmentLabel(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (!trimmed) return "—";
  const mapped = LEGACY_TO_CANONICAL[trimmed.toLowerCase()];
  return mapped ?? trimmed;
}
