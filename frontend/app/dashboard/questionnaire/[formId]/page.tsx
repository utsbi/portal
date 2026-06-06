import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { FillOutForm } from "@/components/dashboard/questionnaire/fill-out-form";
import { fetchFillOutData } from "@/lib/data/questionnaire";

export const dynamic = "force-dynamic";

export default async function FillOutPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId: formIdRaw } = await params;
  const formId = parseInt(formIdRaw, 10);
  if (!Number.isFinite(formId)) notFound();

  const cookieStore = await cookies();
  const projectIdRaw = cookieStore.get("active_project_id")?.value;
  const projectId = projectIdRaw ? parseInt(projectIdRaw, 10) : NaN;
  if (!Number.isFinite(projectId)) redirect("/dashboard");

  const result = await fetchFillOutData(formId, projectId);
  if ("redirect" in result) redirect(result.redirect);
  if ("notFound" in result) notFound();

  return (
    <FillOutForm
      key={`${formId}-${projectId}`}
      formId={result.formId}
      projectId={projectId}
      title={result.title}
      description={result.description}
      schema={result.schema}
      initialAnswers={result.answers}
      initialStatus={result.status}
      opensAt={result.opensAt}
      closesAt={result.closesAt}
    />
  );
}
