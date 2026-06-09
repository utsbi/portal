import { notFound, redirect } from "next/navigation";
import { FormHistory } from "@/components/dashboard/questionnaire/form-history";
import { fetchFormHistory } from "@/lib/data/questionnaire";

export const dynamic = "force-dynamic";

export default async function FormHistoryPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId: formIdRaw } = await params;
  const formId = parseInt(formIdRaw, 10);
  if (!Number.isFinite(formId)) notFound();

  const result = await fetchFormHistory(formId);
  if ("redirect" in result) redirect(result.redirect);
  if ("forbidden" in result) redirect("/dashboard/questionnaire");
  if ("notFound" in result) notFound();

  return (
    <FormHistory
      formId={result.formId}
      title={result.title}
      versions={result.versions}
    />
  );
}
