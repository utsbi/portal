"use client";

import { motion } from "motion/react";

export type RequestStatus = "pending" | "in-progress" | "done" | "denied";

interface StatusBadgeProps {
    status: RequestStatus;
    className?: string;
}

const statusConfig = {
    pending: {
        label: "Pending",
        className: "text-red-400 font-medium",
    },
    "in-progress": {
        label: "In Progress",
        className: "text-yellow-400 font-medium",
    },
    done: {
        label: "Done",
        className: "text-sbi-green font-medium",
    },
    denied: {
        label: "Denied",
        className: "text-slate-400 font-medium",
    },
};

const fallbackConfig = {
    label: "Unknown",
    className: "text-slate-400 font-medium",
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
    const config = statusConfig[status] ?? fallbackConfig;

    return (
        <div
            className={`inline-flex items-center gap-2 pl-2 pr-3 py-1 rounded-full text-xs tracking-wider uppercase border border-transparent ${config.className} ${className}`}
        >
            <div className="relative flex h-2 w-2 items-center justify-center">
                <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping bg-current`}
                />
                <span
                    className={`relative inline-flex h-1.5 w-1.5 rounded-full bg-current`}
                />
            </div>
            {config.label}
        </div>
    );
}
