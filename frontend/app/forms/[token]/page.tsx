import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicForm } from "@/lib/questionnaire/public";
import { PublicForm } from "./public-form";

export const dynamic = "force-dynamic";

// Public forms must not be indexed (capability-link access only).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const form = await getPublicForm(token);
  if (!form) notFound();

  return (
    <PublicForm
      token={token}
      title={form.title}
      description={form.description}
      requiresPassword={form.requiresPassword}
      schema={form.schema}
    />
  );
}
