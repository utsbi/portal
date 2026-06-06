import { notFound, redirect } from "next/navigation";
import { FormBuilder } from "@/components/dashboard/questionnaire/form-builder";
import { fetchEditFormData } from "@/lib/data/questionnaire";

export const dynamic = "force-dynamic";

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId: formIdRaw } = await params;
  const formId = parseInt(formIdRaw, 10);
  if (!Number.isFinite(formId)) notFound();

  const result = await fetchEditFormData(formId);
  if ("redirect" in result) redirect(result.redirect);
  if ("forbidden" in result) redirect("/dashboard/questionnaire");
  if ("notFound" in result) notFound();

  return (
    <FormBuilder
      key={result.id}
      mode="edit"
      formId={result.id}
      initialTitle={result.title}
      initialDescription={result.description ?? ""}
      initialSchema={result.schema}
      initialActive={result.isActive}
      projects={result.projects}
      initialAssignedProjectIds={result.assignedProjectIds}
      initialVisibility={result.visibility}
      initialPublicToken={result.publicToken}
      initialHasPassword={result.hasPassword}
      initialOpensAt={result.opensAt}
      initialClosesAt={result.closesAt}
    />
  );
}
