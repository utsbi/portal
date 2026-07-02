import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatTile } from "./ui";

export interface StatSummaryItem {
  label: string;
  value: ReactNode;
  sublabel?: string;
  icon?: ReactNode;
  tone?: "default" | "accent" | "warning";
}

/**
 * One consistent stat treatment for every dashboard overview.
 *
 * - Below `sm`: a single compact divided card (2-col grid, small uppercase
 *   label + text-xl value, no icons) — roughly a third the height of the tile
 *   grid, so phones lead with content instead of chrome.
 * - From `sm` up: the familiar StatTile grid (icons + sublabels intact).
 *
 * `desktopGridClassName` controls the sm+ grid shape, e.g.
 * `"sm:grid-cols-2 md:grid-cols-4"`.
 */
export function StatSummary({
  items,
  desktopGridClassName = "sm:grid-cols-2 md:grid-cols-4",
  className,
}: {
  items: StatSummaryItem[];
  desktopGridClassName?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {/* Phones: one compact divided summary card */}
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-sbi-dark-border/50 bg-sbi-dark-card/40 sm:hidden">
        {items.map((item, i) => {
          const tone = item.tone ?? "default";
          const isLastOdd = items.length % 2 === 1 && i === items.length - 1;
          return (
            <div
              key={item.label}
              className={cn(
                "flex min-w-0 flex-col gap-0.5 px-4 py-2.5",
                i >= 2 && "border-t border-sbi-dark-border/40",
                !isLastOdd &&
                  i % 2 === 1 &&
                  "border-l border-sbi-dark-border/40",
                isLastOdd && "col-span-2 border-t border-sbi-dark-border/40",
              )}
            >
              <span className="truncate text-[10px] uppercase tracking-[0.15em] text-sbi-muted-dark">
                {item.label}
              </span>
              <span
                className={cn(
                  "truncate text-xl font-light tracking-tight tabular-nums",
                  tone === "accent" && "text-sbi-green",
                  tone === "warning" && "text-amber-400",
                  tone === "default" && "text-white",
                )}
              >
                {item.value}
              </span>
            </div>
          );
        })}
      </div>

      {/* sm and up: the tile grid */}
      <div className={cn("hidden gap-4 sm:grid", desktopGridClassName)}>
        {items.map((item) => (
          <StatTile
            key={item.label}
            label={item.label}
            value={item.value}
            sublabel={item.sublabel}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </div>
    </div>
  );
}
