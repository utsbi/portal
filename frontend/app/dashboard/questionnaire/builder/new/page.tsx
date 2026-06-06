import { redirect } from "next/navigation";
import { FormBuilder } from "@/components/dashboard/questionnaire/form-builder";
import { fetchDirectorData } from "@/lib/data/questionnaire";
import { getFormTemplate } from "@/lib/questionnaire/templates";

export const dynamic = "force-dynamic";

export default async function NewFormPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const result = await fetchDirectorData();
  if ("redirect" in result) redirect(result.redirect);
  if ("forbidden" in result) redirect("/dashboard/questionnaire");

  const { template: templateId } = await searchParams;
  const template = templateId ? getFormTemplate(templateId) : null;

  return (
    <FormBuilder
      mode="create"
      projects={result.projects}
      initialTitle={template?.name ?? ""}
      initialDescription={template?.description ?? ""}
      initialSchema={template ? { fields: template.fields } : undefined}
    />
  );
}
