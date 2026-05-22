"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DotLoader } from "react-spinners";
import { btnGhost, btnPrimary } from "@/components/dashboard/common/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "bg-sbi-dark border-sbi-dark-border rounded-lg px-4 py-3 h-auto text-base md:text-base text-white placeholder:text-white/30 focus-visible:border-sbi-green/50 focus-visible:ring-sbi-green/20 focus-visible:ring-[2px] shadow-none";

const labelClass =
  "text-xs uppercase tracking-[0.1em] text-sbi-muted mb-2 font-medium block";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const canSubmit = password.length >= 8 && password === confirmPassword;

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    const processRecoveryLink = async () => {
      const rawHash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(rawHash);
      const type = params.get("type");
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const hasRecoveryTokens =
        type === "recovery" &&
        typeof accessToken === "string" &&
        typeof refreshToken === "string";

      if (!hasRecoveryTokens || !accessToken || !refreshToken) {
        if (!isMounted) return;
        setVerificationError(null);
        setIsVerifying(false);
        return;
      }

      try {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!isMounted) return;

        if (error) {
          setVerificationError(error.message);
          setIsVerifying(false);
          return;
        }

        setVerificationError(null);
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}${window.location.search}`,
        );
      } catch (unknownError) {
        if (!isMounted) return;
        setVerificationError(
          unknownError instanceof Error
            ? unknownError.message
            : "Something went wrong while validating this link.",
        );
      } finally {
        if (isMounted) {
          setIsVerifying(false);
        }
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setVerificationError(null);
      }
    });

    processRecoveryLink();

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!canSubmit) {
        setUpdateError("Passwords must match and contain at least 8 characters.");
        return;
      }

      const supabase = createClient();
      setIsSubmitting(true);
      setUpdateError(null);
      setIsSuccess(false);

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setUpdateError(error.message);
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setIsSubmitting(false);
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    },
    [canSubmit, password, router],
  );

  useEffect(() => {
    if (isVerifying || verificationError) return;

    let isActive = true;
    const supabase = createClient();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isActive) return;
        if (!data.session) {
          router.replace("/login");
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!isActive) return;
        router.replace("/login");
      });

    return () => {
      isActive = false;
    };
  }, [isVerifying, verificationError, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-sbi-dark">
        <div className="flex flex-col items-center gap-5">
          <DotLoader size={40} color="#22c55e" />
          <span className="text-sbi-muted text-xl">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh w-full bg-sbi-dark flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-sbi-dark-card/40 border border-sbi-dark-border/60 rounded-xl shadow-2xl shadow-black/40 p-8 space-y-6">
        <h1 className="text-xl font-light tracking-tight text-white">Create a new password</h1>

        {isVerifying && <p className="text-sm text-sbi-muted">Verifying your reset link…</p>}

        {!isVerifying && verificationError && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-red-400">Unable to continue</p>
            <p className="text-sm text-sbi-muted">{verificationError}</p>
            <button type="button" onClick={() => router.push("/login")} className={btnGhost}>
              Return to login
            </button>
          </div>
        )}

        {!isVerifying && !verificationError && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-sm text-sbi-muted">
              Enter and confirm a new password for your account.
            </p>

            <div>
              <Label htmlFor="new-password" className={labelClass}>
                New password
              </Label>
              <Input
                id="new-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                /* biome-ignore lint/a11y/noAutofocus: focus moves to the primary input on this dedicated reset screen */
                autoFocus
                className={inputClass}
              />
              <p className="text-xs text-sbi-muted-dark mt-1.5">Minimum 8 characters</p>
            </div>

            <div>
              <Label htmlFor="confirm-password" className={labelClass}>
                Confirm new password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
              />
            </div>

            {updateError && <p className="text-sm text-red-400">{updateError}</p>}
            {isSuccess && (
              <p className="text-sm text-sbi-green">Password updated. Redirecting to login…</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isSuccess || !canSubmit}
              className={`${btnPrimary} w-full`}
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                "Save new password"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
