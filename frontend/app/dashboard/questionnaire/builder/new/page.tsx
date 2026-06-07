import { redirect } from "next/navigation";
import { FormBuilder } from "@/components/dashboard/questionnaire/form-builder";
import {
  fetchCustomTemplate,
  fetchDirectorData,
} from "@/lib/data/questionnaire";
import type { FormSchema } from "@/lib/questionnaire/schema";
import { getFormTemplate } from "@/lib/questionnaire/templates";

export const dynamic = "force-dynamic";

export default async function NewFormPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string; customTemplate?: string }>;
}) {
  const result = await fetchDirectorData();
  if ("redirect" in result) redirect(result.redirect);
  if ("forbidden" in result) redirect("/dashboard/questionnaire");

  const { template: templateId, customTemplate } = await searchParams;

  let seedTitle = "";
  let seedDescription = "";
  let seedSchema: FormSchema | undefined;

  if (templateId) {
    const t = getFormTemplate(templateId);
    if (t) {
      seedTitle = t.name;
      seedDescription = t.description;
      seedSchema = { fields: t.fields };
    }
  } else if (customTemplate) {
    const id = parseInt(customTemplate, 10);
    const t = Number.isFinite(id) ? await fetchCustomTemplate(id) : null;
    if (t) {
      seedTitle = t.name;
      seedDescription = t.description ?? "";
      seedSchema = t.schema;
    }
  }

  return (
    <FormBuilder
      mode="create"
      projects={result.projects}
      initialTitle={seedTitle}
      initialDescription={seedDescription}
      initialSchema={seedSchema}
    />
  );
}
