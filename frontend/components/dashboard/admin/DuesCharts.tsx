"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useMemo } from "react";
import { Panel } from "@/components/dashboard/common/ui";
import { type DuesAccount, type DuesPayment, money } from "@/lib/dues";
import { buildDuesCharts } from "@/lib/dues-charts";

const ringRadius = 67;
const ringLength = 2 * Math.PI * ringRadius;
// SVG circles normally run clockwise. Reflect their local y-axis and rotate
// the start to twelve o'clock for a counterclockwise sweep.
const ringTransform = "translate(88 88) rotate(-90) scale(1 -1)";

export function DuesCharts({
  accounts,
  payments,
}: {
  accounts: DuesAccount[];
  payments: DuesPayment[];
}) {
  const charts = useMemo(
    () => buildDuesCharts(accounts, payments),
    [accounts, payments],
  );
  const reduceMotion = useReducedMotion();
  const paid = charts.statuses.find((s) => s.name === "Paid")?.count ?? 0;
  const percent = accounts.length
    ? Math.round((paid / accounts.length) * 100)
    : 0;
  const maskId = `dues-reveal-${useId().replaceAll(":", "")}`;
  const segments = charts.statuses.filter((s) => s.count > 0);
  const animationKey = segments.map((s) => `${s.name}:${s.count}`).join("|");
  let offset = 0;
  const arcs = segments.map((segment) => {
    const length = (segment.count / accounts.length) * ringLength;
    const gap = segments.length > 1 ? Math.min(4, length / 3) : 0;
    const arc = { ...segment, length: length - gap, offset: offset + gap / 2 };
    offset += length;
    return arc;
  });

  return (
    <section
      aria-label="Dues charts"
      className="grid items-stretch gap-4 lg:grid-cols-2"
    >
      <Panel className="min-w-0">
        <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-sbi-muted">
          Member status
        </h3>
        <figure
          aria-label={`${paid} of ${accounts.length} members paid in full`}
          className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-4"
        >
          <div className="relative h-44 w-44 shrink-0" aria-hidden="true">
            {accounts.length ? (
              <>
                <svg
                  viewBox="0 0 176 176"
                  className="h-full w-full"
                  aria-hidden="true"
                >
                  <defs>
                    <mask
                      id={maskId}
                      maskUnits="userSpaceOnUse"
                      x="0"
                      y="0"
                      width="176"
                      height="176"
                    >
                      <g transform={ringTransform}>
                        <motion.circle
                          key={animationKey}
                          cx="0"
                          cy="0"
                          r={ringRadius}
                          fill="none"
                          stroke="white"
                          strokeWidth="22"
                          strokeDasharray={`${ringLength} ${ringLength}`}
                          initial={
                            reduceMotion
                              ? false
                              : { strokeDashoffset: ringLength }
                          }
                          animate={{ strokeDashoffset: 0 }}
                          transition={{
                            duration: reduceMotion ? 0 : 1.3,
                            ease: "easeInOut",
                          }}
                        />
                      </g>
                    </mask>
                  </defs>
                  <g mask={`url(#${maskId})`}>
                    <g transform={ringTransform}>
                      {arcs.map((arc) => (
                        <circle
                          key={arc.name}
                          cx="0"
                          cy="0"
                          r={ringRadius}
                          fill="none"
                          stroke={arc.color}
                          strokeWidth="20"
                          strokeDasharray={`${arc.length} ${ringLength - arc.length}`}
                          strokeDashoffset={-arc.offset}
                        >
                          <title>
                            {arc.name}: {arc.count}
                          </title>
                        </circle>
                      ))}
                    </g>
                  </g>
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-light tabular-nums text-white">
                    {percent}%
                  </span>
                  <span className="mt-1 text-xs text-sbi-muted">
                    paid in full
                  </span>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-sbi-muted">
                No members assigned.
              </div>
            )}
          </div>
          <figcaption className="min-w-32 flex-1">
            <ul className="space-y-4">
              {charts.statuses.map((s) => (
                <li
                  key={s.name}
                  className="flex items-center gap-2 text-sm text-sbi-muted"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.name}
                  <span className="ml-auto tabular-nums text-white">
                    {s.count}
                  </span>
                </li>
              ))}
            </ul>
          </figcaption>
        </figure>
      </Panel>

      <Panel className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-sbi-muted">
            Payment methods
          </h3>
          <span className="text-sm tabular-nums text-sbi-green">
            {money(charts.collected)}
          </span>
        </div>
        <figure
          aria-label="Collected amount by payment method"
          className="mt-6 flex flex-1 flex-col"
        >
          {charts.methods.length ? (
            <ul className="space-y-4">
              {charts.methods.map((method, index) => {
                const share = charts.collected
                  ? (method.amount / charts.collected) * 100
                  : 0;
                return (
                  <li key={method.name}>
                    <div className="mb-2 flex items-baseline justify-between gap-4 text-sm">
                      <span className="text-sbi-muted">{method.name}</span>
                      <span className="tabular-nums text-white">
                        {money(method.amount)}
                        <span className="ml-3 text-xs text-sbi-muted-dark">
                          {Math.round(share)}%
                        </span>
                      </span>
                    </div>
                    <div
                      aria-hidden="true"
                      className="h-2 overflow-hidden rounded-full bg-sbi-dark-border/50"
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          width: `${share}%`,
                          backgroundColor:
                            method.name === "Unknown" ? "#64748b" : "#22c55e",
                          originX: 0,
                        }}
                        initial={reduceMotion ? false : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.7,
                          delay: reduceMotion ? 0 : index * 0.08,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex min-h-32 flex-1 items-center justify-center text-sm text-sbi-muted">
              No payments recorded.
            </div>
          )}
          {charts.methods.some((method) => method.name === "Unknown") && (
            <figcaption className="mt-4 text-xs text-sbi-muted-dark">
              Unknown includes historical payments without a recorded method.
            </figcaption>
          )}
        </figure>
      </Panel>
    </section>
  );
}
