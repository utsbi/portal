"use client";

import { ErrorFallback } from "@/components/dashboard/common/ErrorFallback";

export default function FilesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} />;
}
