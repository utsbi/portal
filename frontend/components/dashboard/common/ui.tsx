import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export { Modal } from "./Modal";
export { TextField } from "./TextField";

/**
 * Shared dashboard UI primitives. One surface system so every screen reads as
 * the same product. See DESIGN.md "Dashboard System".
 *
 * Button language deliberately mirrors the public site (outlined green that
 * fills on hover) — NOT loud solid-green fills.
 */

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

/**
 * Standard dashboard page wrapper: full height under the 4rem header, dark
 * background, consistent padding, centered max-width column.
 */
export function DashboardShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="h-[calc(100vh-4rem)] bg-sbi-dark flex flex-col p-4 sm:p-6 md:p-8 overflow-hidden">
      <div
        className={cn(
          "max-w-7xl w-full mx-auto flex flex-col h-full min-h-0",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Page title + subtitle + optional right-aligned action. Every dashboard page
 * uses this so headers are pixel-identical.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4 mb-6 shrink-0",
        className,
      )}
    >
      <div>
        <h1 className="text-2xl md:text-3xl font-light tracking-tight text-white mb-2">
          {title}
        </h1>
        {subtitle ? <p className="text-sbi-muted text-sm">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section label (green line + uppercase tracked text — public-site pattern)
// ---------------------------------------------------------------------------

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 mb-4", className)}>
      <div className="w-10 h-px bg-sbi-green" />
      <span className="text-xs tracking-[0.25em] uppercase text-sbi-green">
        {children}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Surface / Panel — the containment system
// ---------------------------------------------------------------------------

/**
 * The canonical contained surface. Everything that floats on black today
 * should sit inside one of these.
 */
export function Panel({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-sbi-dark-card/40 border border-sbi-dark-border/50 rounded-xl",
        padded && "p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile — replaces bare numbers floating on black
// ---------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  sublabel,
  icon,
  accent = false,
  tone,
}: {
  label: string;
  value: ReactNode;
  sublabel?: string;
  icon?: ReactNode;
  accent?: boolean;
  tone?: "default" | "accent" | "warning";
}) {
  const resolvedTone: "default" | "accent" | "warning" =
    tone ?? (accent ? "accent" : "default");

  return (
    <div
      className={cn(
        "bg-sbi-dark-card/40 border rounded-xl p-5 transition-colors",
        resolvedTone === "warning"
          ? "border-amber-400/40"
          : "border-sbi-dark-border/50",
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[0.7rem] tracking-[0.15em] uppercase text-sbi-muted-dark">
          {label}
        </span>
        {icon ? (
          <span
            className={cn(
              resolvedTone === "warning"
                ? "text-amber-400"
                : "text-sbi-muted-dark",
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "text-4xl font-thin tracking-tight tabular-nums",
          resolvedTone === "accent" && "text-sbi-green",
          resolvedTone === "warning" && "text-amber-400",
          resolvedTone === "default" && "text-white",
        )}
      >
        {value}
      </div>
      {sublabel ? (
        <p className="text-xs text-sbi-muted-dark mt-2">{sublabel}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state — fills its container instead of being a tiny island
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex-1 flex flex-col items-center justify-center text-center px-6 py-16",
        className,
      )}
    >
      {icon ? (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-sbi-green/20 bg-sbi-green/5 text-sbi-green">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-light text-white">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-sbi-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Label + field language — one micro-label tier (0.15em) and one dark input
// style, so forms across the dashboard stop re-inventing them.
// Tracking tiers: SectionLabel eyebrow = 0.25em · micro-label = 0.15em ·
// button text keeps its own tight 0.04em (intentional).
// ---------------------------------------------------------------------------

/** Small uppercase label for form fields, meta rows, and stat tiles. */
export const labelClass =
  "text-xs font-medium uppercase tracking-[0.15em] text-sbi-muted";

/** Canonical dark input / textarea styling (sbi theme — NOT stock shadcn). */
export const inputClass =
  "w-full bg-sbi-dark-card text-white border border-sbi-dark-border/50 rounded-md px-3 py-2 text-sm " +
  "placeholder:text-sbi-muted-dark focus:outline-none focus:border-sbi-green/50 transition-colors disabled:opacity-50";

/**
 * Dark <select> with a custom chevron inset from the right edge (the native
 * arrow sits flush against the border). `className` lands on the wrapper so
 * layout utilities like margins still work; pass select props through directly.
 */
export function SelectField({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select
        {...props}
        className={cn(inputClass, "w-full appearance-none pr-9")}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-sbi-muted-dark"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Button class language (outlined green → fills on hover; public-site match)
// ---------------------------------------------------------------------------

/** Focus-visible ring shared by every button token (keyboard a11y). */
const btnFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sbi-dark";

/** Primary action. Refined outline, not a loud solid fill. */
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 px-5 h-10 text-xs font-medium tracking-[0.04em] uppercase " +
  "bg-sbi-green/10 text-sbi-green border border-sbi-green/30 rounded-md cursor-pointer " +
  "hover:bg-sbi-green hover:text-sbi-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors " +
  `${btnFocus} focus-visible:ring-sbi-green/50`;

/** Secondary / neutral action. */
export const btnGhost =
  "inline-flex items-center justify-center gap-2 px-5 h-10 text-xs font-medium tracking-[0.04em] uppercase " +
  "bg-transparent text-sbi-muted border border-sbi-dark-border/60 rounded-md cursor-pointer " +
  "hover:text-white hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors " +
  `${btnFocus} focus-visible:ring-white/30`;

/** Destructive action. Red mirror of btnPrimary for delete/deny confirms. */
export const btnDanger =
  "inline-flex items-center justify-center gap-2 px-5 h-10 text-xs font-medium tracking-[0.04em] uppercase " +
  "bg-red-500/10 text-red-300 border border-red-500/40 rounded-md cursor-pointer " +
  "hover:bg-red-500/20 hover:text-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors " +
  `${btnFocus} focus-visible:ring-red-500/50`;
