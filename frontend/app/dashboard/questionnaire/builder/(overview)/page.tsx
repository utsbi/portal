import { redirect } from "next/navigation";
import { BuilderOverview } from "@/components/dashboard/questionnaire/builder-overview";
import { fetchDirectorData } from "@/lib/data/questionnaire";

export const dynamic = "force-dynamic";

export default async function BuilderPage() {
  const result = await fetchDirectorData();
  if ("redirect" in result) redirect(result.redirect);
  if ("forbidden" in result) redirect("/dashboard/questionnaire");

  return <BuilderOverview forms={result.forms} />;
}
