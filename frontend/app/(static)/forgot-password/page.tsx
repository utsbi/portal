"use client";

import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { requestPasswordResetAction } from "../login/actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await requestPasswordResetAction(email);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "We couldn't send a reset email.");
      return;
    }
    setSent(true);
  };

  return (
    <main className="min-h-svh bg-sbi-dark px-4 py-12 text-white flex items-center justify-center">
      <section className="w-full max-w-md rounded-xl border border-sbi-dark-border/60 bg-sbi-dark-card/40 p-8 shadow-xl shadow-black/30">
        <div className="mb-7">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-sbi-green">
            SBI Portal
          </p>
          <h1 className="text-2xl font-light tracking-tight">Reset password</h1>
          <p className="mt-2 text-sm leading-relaxed text-sbi-muted">
            Enter your account email and we&apos;ll send a secure reset link.
          </p>
        </div>

        {sent ? (
          <div className="space-y-5" aria-live="polite">
            <div className="rounded-md border border-sbi-green/30 bg-sbi-green/10 p-4 text-sm leading-relaxed text-sbi-muted">
              If an SBI Portal account uses that address, a reset link is on its
              way. Check your inbox and spam folder.
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-sbi-muted transition-colors hover:text-sbi-green"
            >
              <ArrowLeft className="size-4" /> Return to sign in
            </Link>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-xs font-medium uppercase tracking-[0.15em] text-sbi-muted"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-sbi-muted-dark" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting}
                  className="h-11 w-full rounded-md border border-sbi-dark-border bg-sbi-dark px-4 pl-10 text-sm text-white outline-none transition-colors placeholder:text-sbi-muted-dark focus:border-sbi-green focus:ring-2 focus:ring-sbi-green/20 disabled:opacity-60"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            {error ? (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 w-full items-center justify-center rounded-md border border-sbi-green/30 bg-sbi-green/10 px-4 text-sm font-medium text-sbi-green transition-colors hover:bg-sbi-green hover:text-sbi-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Sending reset link..." : "Email reset link"}
            </button>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-sbi-muted transition-colors hover:text-white"
            >
              <ArrowLeft className="size-4" /> Back to sign in
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
