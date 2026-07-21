import { redirect } from "next/navigation";
import { TemplatesView } from "@/components/dashboard/questionnaire/templates-view";
import { fetchTemplatesData } from "@/lib/data/questionnaire";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const result = await fetchTemplatesData();
  if ("redirect" in result) redirect(result.redirect);
  if ("forbidden" in result) redirect("/dashboard/questionnaire");

  return <TemplatesView templates={result.templates} />;
}
