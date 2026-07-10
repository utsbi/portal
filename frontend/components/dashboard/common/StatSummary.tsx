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
 * - Below `sm`: a single compact divided card. Layout adapts to the item count
 *   so 3 stats land in a single row (the common case), while 4 wraps to 2×2
 *   and 1–2 stay at their natural width.
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
  // 3 items get a single row on phones; everything else collapses to 2 cols.
  const mobileCols = items.length === 3 ? 3 : Math.min(items.length, 2);

  return (
    <div className={className}>
      {/* Phones: one compact divided summary card */}
      <div
        className={cn(
          "grid overflow-hidden rounded-xl border border-sbi-dark-border/50 bg-sbi-dark-card/40 sm:hidden",
          mobileCols === 3 ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        {items.map((item, i) => {
          const tone = item.tone ?? "default";
          const isLastInRow =
            i === items.length - 1 || (i + 1) % mobileCols === 0;
          return (
            <div
              key={item.label}
              className={cn(
                "flex min-w-0 flex-col gap-0.5 px-2.5 py-2.5",
                i >= mobileCols && "border-t border-sbi-dark-border/40",
                !isLastInRow && "border-r border-sbi-dark-border/40",
              )}
            >
              <span className="truncate text-[10px] uppercase tracking-[0.1em] text-sbi-muted-dark">
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
