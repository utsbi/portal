"use client";

import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import bg from "@/assets/images/login.jpg";
import { loginAction, checkAuthAction } from "./actions";

const portalTypes = ["Client", "Member", "Sponsor"];

export default function LoginPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [portalTypeIndex, setPortalTypeIndex] = useState(0);
  const [formState, setFormState] = useState({
    email: "",
    password: "",
  });

  // Cycle through portal types
  useEffect(() => {
    const interval = setInterval(() => {
      setPortalTypeIndex((prev) => (prev + 1) % portalTypes.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const result = await checkAuthAction();
      
      if (result.authenticated && result.urlSlug) {
        router.replace(`/${result.urlSlug}/dashboard`);
      } else {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginAction(formState.email, formState.password);

      if (!result.success) {
        setError(result.error || "An error occurred. Please try again.");
        if (result.error === "Invalid email or password") {
          setLoginAttempts((prev) => prev + 1);
        }
        return;
      }

      if (result.urlSlug) {
        router.replace(`/${result.urlSlug}/dashboard`);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formState.email) {
      setError("Please enter your email address first");
      return;
    }

    // Use a dynamic import for the client-side forgot password
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      formState.email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/auth/update-password`,
      },
    );

    if (error) {
      setError("Failed to send reset email. Please try again.");
    } else {
      setError(null);
      alert("Password reset email sent. Please check your inbox.");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-sbi-dark flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-sbi-green border-t-transparent rounded-full"
          />
          <span className="text-sbi-muted text-sm tracking-wider uppercase">
            Loading...
          </span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sbi-dark text-white relative overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={bg}
          alt="Login background"
          fill
          quality={100}
          priority
          className="object-cover brightness-[0.35]"
        />
        <div className="absolute inset-0 bg-linear-to-br from-sbi-dark/70 via-sbi-dark/50 to-sbi-dark/70" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-8 py-24">
        <motion.div
          initial={{ y: 40 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-center mb-12"
          >
            {/* <Link href="/" className="inline-block group"> */}
            {/*   <span className="text-4xl font-light tracking-tight"> */}
            {/*     <span className="text-sbi-green">S</span>BI */}
            {/*   </span> */}
            {/*   <div className="h-px w-0 bg-sbi-green group-hover:w-full transition-all duration-300 mx-auto" /> */}
            {/* </Link> */}
            <p className="mt-4 text-sbi-muted text-sm tracking-wider uppercase flex items-center justify-center gap-[0.3em]">
              <span>SBI</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={portalTypes[portalTypeIndex]}
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "-100%", opacity: 0 }}
                    transition={{
                      duration: 0.4,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="inline-block"
                  >
                    {portalTypes[portalTypeIndex]}
                  </motion.span>
                </AnimatePresence>
              <span>Portal</span>
            </p>
          </motion.div>

          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="relative"
          >
            <div className="absolute -top-3 -left-3 w-6 h-6 border-t border-l border-white/20" />
            <div className="absolute -top-3 -right-3 w-6 h-6 border-t border-r border-white/20" />
            <div className="absolute -bottom-3 -left-3 w-6 h-6 border-b border-l border-white/20" />
            <div className="absolute -bottom-3 -right-3 w-6 h-6 border-b border-r border-white/20" />

            <div className="bg-white/[0.08] backdrop-blur-xl border border-white/[0.15] p-8 md:p-10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-px bg-sbi-green" />
                <h1 className="text-xs tracking-[0.3em] uppercase text-sbi-green">
                  Sign In
                </h1>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="group">
                  <label
                    htmlFor="email"
                    className="block text-xs tracking-[0.2em] uppercase text-white/60 mb-3 group-focus-within:text-sbi-green transition-colors"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-sbi-green transition-colors">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formState.email}
                      onChange={handleChange}
                      required
                      autoComplete="email"
                      disabled={isLoading}
                      className="w-full py-3 pl-8 bg-transparent border-b border-white/20 focus:border-sbi-green focus:outline-none text-white placeholder:text-white/30 transition-colors disabled:opacity-50"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div className="group">
                  <label
                    htmlFor="password"
                    className="block text-xs tracking-[0.2em] uppercase text-white/60 mb-3 group-focus-within:text-sbi-green transition-colors"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-sbi-green transition-colors">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      name="password"
                      value={formState.password}
                      onChange={handleChange}
                      required
                      autoComplete="current-password"
                      disabled={isLoading}
                      className="w-full py-3 pl-8 pr-10 bg-transparent border-b border-white/20 focus:border-sbi-green focus:outline-none text-white placeholder:text-white/30 transition-colors disabled:opacity-50"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 text-sm"
                  >
                    {error}
                  </motion.p>
                )}

                {loginAttempts >= 2 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-sm text-white/50 hover:text-sbi-green transition-colors"
                    >
                      Forgot your password?
                    </button>
                  </motion.div>
                )}

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  className="relative w-full inline-flex items-center justify-center gap-3 px-8 py-4 text-sm font-medium tracking-wider uppercase bg-sbi-green/10 text-sbi-green border border-sbi-green/30 hover:bg-sbi-green hover:text-sbi-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 mt-8"
                  whileHover={{ scale: isLoading ? 1 : 1.02 }}
                  whileTap={{ scale: isLoading ? 1 : 0.98 }}
                >
                  {isLoading ? (
                    <>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-4 h-4 border-2 border-sbi-green border-t-transparent rounded-full"
                      />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </motion.button>
              </form>

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <Link
                  href="/"
                  className="text-sm text-white/50 hover:text-white transition-colors"
                >
                  ← Back to home
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
