"use client";

import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { btnGhost, btnPrimary } from "@/components/dashboard/common/ui";
import { cn } from "@/lib/utils";

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="h-[calc(100vh-4rem)] bg-sbi-dark flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex size-12 items-center justify-center rounded-full border border-red-500/20 bg-red-500/5">
          <AlertTriangle className="size-5 text-red-400" strokeWidth={1.5} />
        </div>

        <h2 className="text-lg font-light text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-sbi-muted mb-8">
          An unexpected error occurred. You can try again or return to the
          dashboard.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className={cn(btnPrimary, "h-9")}
          >
            <RotateCcw className="size-4" />
            Try again
          </button>
          <Link href="/dashboard" className={cn(btnGhost, "h-9")}>
            <Home className="size-4" />
            Dashboard
          </Link>
        </div>

        {process.env.NODE_ENV === "development" && error.message && (
          <details className="mt-8 text-left">
            <summary className="text-xs text-sbi-muted-dark cursor-pointer hover:text-sbi-muted">
              Error details
            </summary>
            <pre className="mt-2 text-xs text-red-400/70 bg-red-500/5 rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
