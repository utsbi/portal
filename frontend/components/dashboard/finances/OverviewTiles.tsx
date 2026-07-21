"use client";

import { Flame, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { StatSummary } from "@/components/dashboard/common/StatSummary";

interface OverviewTilesProps {
  totalBudget: number;
  totalSpent: number;
  periodStart: string;
  periodEnd: string;
  formatCurrency: (n: number) => string;
}

export function OverviewTiles({
  totalBudget,
  totalSpent,
  periodStart,
  periodEnd,
  formatCurrency,
}: OverviewTilesProps) {
  const remaining = Math.max(totalBudget - totalSpent, 0);
  const overBy = Math.max(totalSpent - totalBudget, 0);
  const spentPercent =
    totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  const remainingTone: "accent" | "warning" =
    totalSpent > totalBudget ? "warning" : "accent";

  const burnRate = (() => {
    const start = new Date(periodStart).getTime();
    const end = new Date(periodEnd).getTime();
    const now = Math.min(Date.now(), end);
    if (Number.isNaN(start) || now < start) return null;
    const months = Math.max(
      1,
      Math.ceil((now - start) / (1000 * 60 * 60 * 24 * 30)),
    );
    return Math.round(totalSpent / months);
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <StatSummary
        desktopGridClassName="sm:grid-cols-2 md:grid-cols-4"
        items={[
          {
            label: "Total Budget",
            value: formatCurrency(totalBudget),
            sublabel: "Project allocation",
            icon: <Wallet className="h-4 w-4" />,
          },
          {
            label: "Spent",
            value: formatCurrency(totalSpent),
            sublabel: `${spentPercent}% of budget`,
            icon: <Flame className="h-4 w-4" />,
          },
          {
            label: overBy > 0 ? "Over Budget" : "Remaining",
            value:
              overBy > 0
                ? `+${formatCurrency(overBy)}`
                : formatCurrency(remaining),
            sublabel:
              overBy > 0
                ? `${spentPercent}% of budget`
                : `${Math.max(100 - spentPercent, 0)}% left`,
            icon: <PiggyBank className="h-4 w-4" />,
            tone: remainingTone,
          },
          {
            label: "Avg. Burn Rate",
            value: burnRate !== null ? formatCurrency(burnRate) : "—",
            sublabel: "Per month so far",
            icon: <TrendingUp className="h-4 w-4" />,
          },
        ]}
      />
    </motion.div>
  );
}
