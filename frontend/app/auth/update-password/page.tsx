"use client";

import { Lock } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DotLoader } from "react-spinners";
import bg from "@/assets/images/login.jpg";
import { btnGhost } from "@/components/dashboard/common/ui";
import { createClient } from "@/lib/supabase/client";
import { markPortalAccountActivated } from "./actions";

const RECOVERY_MARKER_KEY = "sbi:recovery-session";
const RECOVERY_MARKER_MAX_AGE_MS = 60 * 60 * 1000;

function readRecoveryMarker(): { userId: string; expiresAt: number } | null {
  try {
    const raw = window.localStorage.getItem(RECOVERY_MARKER_KEY);
    if (!raw) return null;
    const marker = JSON.parse(raw) as { userId?: unknown; expiresAt?: unknown };
    if (
      typeof marker.userId !== "string" ||
      typeof marker.expiresAt !== "number" ||
      marker.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(RECOVERY_MARKER_KEY);
      return null;
    }
    return { userId: marker.userId, expiresAt: marker.expiresAt };
  } catch {
    return null;
  }
}

function writeRecoveryMarker(userId: string) {
  window.localStorage.setItem(
    RECOVERY_MARKER_KEY,
    JSON.stringify({
      userId,
      expiresAt: Date.now() + RECOVERY_MARKER_MAX_AGE_MS,
    }),
  );
}

function recoveryErrorMessage(params: URLSearchParams): string | null {
  const code = params.get("error_code") ?? params.get("error");
  if (!code) return null;
  if (code === "otp_expired" || code === "access_denied") {
    return "This reset link has expired or has already been used. Request a new link to continue.";
  }
  return "This reset link is unavailable. Request a new link to continue.";
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
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
      const queryParams = new URLSearchParams(window.location.search);
      const flow = queryParams.get("flow");
      const rawHash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(rawHash);
      const queryError =
        recoveryErrorMessage(queryParams) ?? recoveryErrorMessage(params);
      const type = params.get("type");
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const hasRecoveryTokens =
        type === "recovery" &&
        typeof accessToken === "string" &&
        typeof refreshToken === "string";

      if (hasRecoveryTokens && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!isMounted) return;
        if (error) {
          setVerificationError(
            "This reset link has expired or has already been used. Request a new link to continue.",
          );
          setIsLoading(false);
          setIsVerifying(false);
          return;
        }
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          writeRecoveryMarker(data.session.user.id);
          setHasRecoverySession(true);
        }
        setVerificationError(null);
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}?flow=recovery`,
        );
        setIsLoading(false);
        setIsVerifying(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      const marker = readRecoveryMarker();
      const markerMatchesSession = Boolean(
        data.session && marker?.userId === data.session.user.id,
      );

      // The continue route verifies the token on the server and supplies a
      // flow marker. Establish the browser-side marker once its session cookie
      // is visible to the client.
      if (data.session && (flow === "recovery" || flow === "invite")) {
        writeRecoveryMarker(data.session.user.id);
        setHasRecoverySession(true);
        setVerificationError(null);
        setIsLoading(false);
        setIsVerifying(false);
        return;
      }

      if (queryError) {
        if (markerMatchesSession) {
          setHasRecoverySession(true);
          setRecoveryNotice(
            "This link was already opened in this browser. Continue with the active recovery session below.",
          );
          setVerificationError(null);
        } else {
          setVerificationError(queryError);
        }
        setIsLoading(false);
        setIsVerifying(false);
        return;
      }

      if (markerMatchesSession) {
        setHasRecoverySession(true);
        setVerificationError(null);
        setIsLoading(false);
        setIsVerifying(false);
        return;
      }

      router.replace("/login");
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setVerificationError(null);
        setHasRecoverySession(true);
      }
    });

    processRecoveryLink();

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [router]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!canSubmit) {
        setUpdateError(
          "Passwords must match and contain at least 8 characters.",
        );
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

      const activation = await markPortalAccountActivated();
      if ("error" in activation) {
        // The password was accepted. Keep the success state, but leave a
        // useful diagnostic in the console if the administrative status
        // update needs to be retried rather than making the user submit twice.
        console.error(
          "Failed to activate the portal profile",
          activation.error,
        );
      }

      setIsSuccess(true);
      setIsSubmitting(false);
      setPassword("");
      setConfirmPassword("");

      window.localStorage.removeItem(RECOVERY_MARKER_KEY);
      await supabase.auth.signOut({ scope: "local" });
      window.setTimeout(() => router.replace("/login?reset=success"), 1200);
    },
    [canSubmit, password, router],
  );

  if (isLoading && !verificationError) {
    return (
      <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-sbi-dark">
        <Image
          src={bg}
          alt=""
          fill
          priority
          className="object-cover brightness-[0.35]"
        />
        <div className="absolute inset-0 bg-linear-to-br from-sbi-dark/70 via-sbi-dark/50 to-sbi-dark/70" />
        <div className="flex flex-col items-center gap-5">
          <DotLoader size={40} color="#22c55e" />
          <span className="relative text-sbi-muted text-sm uppercase tracking-wider">
            Loading…
          </span>
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-sbi-dark text-white">
      <div className="absolute inset-0">
        <Image
          src={bg}
          alt=""
          fill
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
                  New password
                </h1>
              </div>

              {isVerifying && (
                <p className="text-sm text-white/60">
                  Verifying your reset link…
                </p>
              )}

              {!isVerifying && verificationError && (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-red-400">
                    Unable to continue
                  </p>
                  <p className="text-sm text-white/60">{verificationError}</p>
                  <button
                    type="button"
                    onClick={() => router.push("/login")}
                    className={btnGhost}
                  >
                    Request a new link
                  </button>
                </div>
              )}

              {!isVerifying && !verificationError && hasRecoverySession && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {recoveryNotice && (
                    <p className="border border-sbi-green/25 bg-sbi-green/10 px-4 py-3 text-sm leading-relaxed text-sbi-green">
                      {recoveryNotice}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed text-white/60">
                    Enter and confirm a new password for your account.
                  </p>

                  <div className="group">
                    <label
                      htmlFor="new-password"
                      className="mb-3 block text-xs uppercase tracking-[0.2em] text-white/60 transition-colors group-focus-within:text-sbi-green"
                    >
                      New password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-sbi-green" />
                      <input
                        id="new-password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full border-b border-white/20 bg-transparent py-3 pl-8 text-white outline-none transition-colors placeholder:text-white/30 focus:border-sbi-green disabled:opacity-50"
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-white/40">
                      Minimum 8 characters
                    </p>
                  </div>

                  <div className="group">
                    <label
                      htmlFor="confirm-password"
                      className="mb-3 block text-xs uppercase tracking-[0.2em] text-white/60 transition-colors group-focus-within:text-sbi-green"
                    >
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-sbi-green" />
                      <input
                        id="confirm-password"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full border-b border-white/20 bg-transparent py-3 pl-8 text-white outline-none transition-colors placeholder:text-white/30 focus:border-sbi-green disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {updateError && (
                    <p className="text-sm text-red-400" role="alert">
                      {updateError}
                    </p>
                  )}
                  {isSuccess && (
                    <p className="text-sm text-sbi-green" aria-live="polite">
                      Password updated. Redirecting to login…
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || isSuccess || !canSubmit}
                    className="inline-flex w-full items-center justify-center gap-3 border border-sbi-green/30 bg-sbi-green/10 px-8 py-4 text-sm font-medium uppercase tracking-wider text-sbi-green transition-all duration-300 hover:bg-sbi-green hover:text-sbi-dark disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? "Saving…" : "Save new password"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
