import type { FieldDef } from "@/lib/questionnaire/schema";

// ---------------------------------------------------------------------------
// Built-in starter templates. Field ids are stable (hardcoded) so a template
// renders deterministically; the builder treats them like any other schema.
// ---------------------------------------------------------------------------

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  fields: FieldDef[];
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "member-application",
    name: "Member Application",
    description: "Recruit new student members.",
    fields: [
      {
        id: "t_dept",
        type: "short_text",
        label: "Major / department",
        required: true,
      },
      {
        id: "t_year",
        type: "short_text",
        label: "Year of study",
        required: true,
      },
      {
        id: "t_interest",
        type: "checkboxes",
        label: "Areas of interest",
        required: true,
        options: [
          { value: "engineering", label: "Engineering" },
          { value: "architecture", label: "Architecture" },
          { value: "tech", label: "Tech" },
          { value: "business", label: "Business" },
          { value: "pr", label: "PR" },
          { value: "legal", label: "Legal" },
          { value: "research", label: "Research" },
        ],
      },
      {
        id: "t_why",
        type: "paragraph",
        label: "Why do you want to join SBI?",
        required: true,
      },
      {
        id: "t_links",
        type: "short_text",
        label: "Portfolio or LinkedIn (optional)",
      },
    ],
  },
  {
    id: "feedback-survey",
    name: "Feedback Survey",
    description: "Collect satisfaction and open feedback.",
    fields: [
      {
        id: "t_sat",
        type: "scale",
        label: "Overall satisfaction",
        required: true,
        validation: {
          min: 1,
          max: 5,
          step: 1,
          minLabel: "Poor",
          maxLabel: "Excellent",
        },
      },
      { id: "t_well", type: "paragraph", label: "What went well?" },
      { id: "t_improve", type: "paragraph", label: "What could be better?" },
      {
        id: "t_rec",
        type: "radio",
        label: "Would you recommend us?",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "maybe", label: "Maybe" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },
  {
    id: "event-rsvp",
    name: "Event RSVP",
    description: "Confirm attendance and headcount.",
    fields: [
      {
        id: "t_attend",
        type: "radio",
        label: "Will you attend?",
        required: true,
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
          { value: "maybe", label: "Maybe" },
        ],
      },
      {
        id: "t_guests",
        type: "number",
        label: "Number of guests (including you)",
        validation: { min: 0, max: 20 },
      },
      { id: "t_diet", type: "short_text", label: "Dietary restrictions" },
    ],
  },
];

export function getFormTemplate(id: string): FormTemplate | null {
  return FORM_TEMPLATES.find((t) => t.id === id) ?? null;
}
