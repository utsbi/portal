import { notFound, redirect } from "next/navigation";
import { ResponsesView } from "@/components/dashboard/questionnaire/responses-view";
import { fetchResponsesData } from "@/lib/data/questionnaire";

export const dynamic = "force-dynamic";

export default async function ResponsesPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId: formIdRaw } = await params;
  const formId = parseInt(formIdRaw, 10);
  if (!Number.isFinite(formId)) notFound();

  const result = await fetchResponsesData(formId);
  if ("redirect" in result) redirect(result.redirect);
  if ("forbidden" in result) redirect("/dashboard/questionnaire");
  if ("notFound" in result) notFound();

  return (
    <ResponsesView
      title={result.title}
      schema={result.schema}
      rows={result.rows}
    />
  );
}
