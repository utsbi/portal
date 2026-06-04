import { redirect } from "next/navigation";
import { FormBuilder } from "@/components/dashboard/questionnaire/form-builder";
import { fetchDirectorData } from "@/lib/data/questionnaire";

export const dynamic = "force-dynamic";

export default async function NewFormPage() {
  const result = await fetchDirectorData();
  if ("redirect" in result) redirect(result.redirect);
  if ("forbidden" in result) redirect("/dashboard/questionnaire");

  return <FormBuilder mode="create" projects={result.projects} />;
}
