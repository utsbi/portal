"use client";

import { ArrowLeft, Mail } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import bg from "@/assets/images/login.jpg";
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
    <main className="relative min-h-svh overflow-hidden bg-sbi-dark text-white">
      <div className="absolute inset-0">
        <Image
          src={bg}
          alt=""
          fill
          quality={100}
          priority
          className="object-cover brightness-[0.35]"
        />
        <div className="absolute inset-0 bg-linear-to-br from-sbi-dark/70 via-sbi-dark/50 to-sbi-dark/70" />
      </div>

      <div className="relative z-10 flex min-h-svh items-center justify-center px-8 py-24">
        <motion.section
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="mb-12 text-center">
            <p className="text-sm uppercase tracking-wider text-sbi-muted">
              SBI <span className="text-sbi-green">Portal</span>
            </p>
          </div>

          <div className="relative">
            <div className="absolute -left-3 -top-3 h-6 w-6 border-l border-t border-white/20" />
            <div className="absolute -right-3 -top-3 h-6 w-6 border-r border-t border-white/20" />
            <div className="absolute -bottom-3 -left-3 h-6 w-6 border-b border-l border-white/20" />
            <div className="absolute -bottom-3 -right-3 h-6 w-6 border-b border-r border-white/20" />

            <div className="border border-white/[0.15] bg-white/[0.08] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl md:p-10">
              <div className="mb-8 flex items-center gap-3">
                <div className="h-px w-8 bg-sbi-green" />
                <h1 className="text-xs uppercase tracking-[0.3em] text-sbi-green">
                  Reset password
                </h1>
              </div>

              {sent ? (
                <div className="space-y-5" aria-live="polite">
                  <div className="border border-sbi-green/30 bg-sbi-green/10 p-4 text-sm leading-relaxed text-sbi-muted">
                    If an SBI Portal account uses that address, a reset link is
                    on its way. Check your inbox and spam folder.
                  </div>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-sbi-green"
                  >
                    <ArrowLeft className="size-4" /> Return to sign in
                  </Link>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <p className="text-sm leading-relaxed text-white/60">
                    Enter your account email and we&apos;ll send a secure reset
                    link.
                  </p>
                  <div className="group">
                    <label
                      htmlFor="email"
                      className="mb-3 block text-xs uppercase tracking-[0.2em] text-white/60 transition-colors group-focus-within:text-sbi-green"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-sbi-green" />
                      <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        disabled={submitting}
                        className="w-full border-b border-white/20 bg-transparent py-3 pl-8 text-white outline-none transition-colors placeholder:text-white/30 focus:border-sbi-green disabled:opacity-50"
                        placeholder="your@email.com"
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
                    className="inline-flex w-full items-center justify-center border border-sbi-green/30 bg-sbi-green/10 px-8 py-4 text-sm font-medium uppercase tracking-wider text-sbi-green transition-all duration-300 hover:bg-sbi-green hover:text-sbi-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Sending reset link..." : "Email reset link"}
                  </button>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"
                  >
                    <ArrowLeft className="size-4" /> Back to sign in
                  </Link>
                </form>
              )}
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
