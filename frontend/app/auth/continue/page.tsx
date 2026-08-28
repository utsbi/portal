import Image from "next/image";
import Link from "next/link";
import bg from "@/assets/images/login.jpg";
import { ContinueForm } from "./continue-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Continue to SBI Portal",
  robots: "noindex, nofollow",
};

export default async function ContinuePage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const tokenHash = params.token_hash?.trim() ?? "";
  const type = params.type?.trim() ?? "";
  const hasToken = Boolean(tokenHash && type);

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-sbi-dark px-6 py-16 text-white">
      <Image
        src={bg}
        alt=""
        fill
        priority
        className="object-cover brightness-[0.35]"
      />
      <div className="absolute inset-0 bg-linear-to-br from-sbi-dark/80 via-sbi-dark/55 to-sbi-dark/80" />
      <section className="relative z-10 w-full max-w-md">
        <div className="mb-10 text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-sbi-muted">
            SBI <span className="text-sbi-green">Portal</span>
          </p>
        </div>
        <div className="border border-white/[0.15] bg-white/[0.08] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-xl md:p-10">
          <div className="mb-8 flex items-center gap-3">
            <div className="h-px w-8 bg-sbi-green" />
            <h1 className="text-xs uppercase tracking-[0.28em] text-sbi-green">
              Secure link
            </h1>
          </div>
          {hasToken ? (
            <>
              <h2 className="text-2xl font-medium tracking-tight text-white">
                Continue when you’re ready
              </h2>
              <p className="mt-4 mb-8 text-sm leading-relaxed text-white/65">
                This button opens your secure SBI Portal session. It keeps email
                scanners from using the link before you do.
              </p>
              <ContinueForm tokenHash={tokenHash} type={type} />
            </>
          ) : (
            <>
              <h2 className="text-2xl font-medium tracking-tight text-white">
                This link is unavailable
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/65">
                Request a new link and use it from the same browser.
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex w-full items-center justify-center border border-white/20 px-6 py-4 text-sm uppercase tracking-[0.16em] text-white/75 transition-colors hover:border-sbi-green hover:text-sbi-green"
              >
                Return to login
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
