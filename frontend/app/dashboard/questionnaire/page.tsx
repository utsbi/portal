import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { QuestionnaireView } from "@/components/dashboard/questionnaire";
import { fetchQuestionnaireData } from "@/lib/data/questionnaire";

export const dynamic = "force-dynamic";

export default async function QuestionnairePage() {
  const cookieStore = await cookies();
  const projectIdRaw = cookieStore.get("active_project_id")?.value;
  const projectId = projectIdRaw ? parseInt(projectIdRaw, 10) : NaN;
  if (!Number.isFinite(projectId)) redirect("/dashboard");

  const result = await fetchQuestionnaireData(projectId);
  if ("redirect" in result) redirect(result.redirect);

  return (
    <QuestionnaireView
      key={projectId}
      projectId={projectId}
      forms={result.forms}
    />
  );
}
