"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function DataTablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: DataTablePaginationProps) {
  if (totalPages <= 1) return null;

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.04]">
      <span className="text-xs text-sbi-muted-dark tabular-nums">
        Showing {startIndex}–{endIndex} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            "p-1.5 rounded-lg text-sbi-muted hover:text-white hover:bg-white/[0.06] transition-colors",
            currentPage === 1 &&
              "opacity-30 cursor-not-allowed pointer-events-none",
          )}
        >
          <CaretLeftIcon size={14} />
        </button>

        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => {
            return (
              p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
            );
          })
          .reduce<(number | "...")[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((item, i, arr) =>
            item === "..." ? (
              <span
                key={`ellipsis-${String(arr[i - 1])}`}
                className="px-1 text-xs text-sbi-muted-dark"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item as number)}
                className={cn(
                  "min-w-[28px] h-7 px-2 rounded-lg text-xs transition-colors",
                  currentPage === item
                    ? "bg-sbi-green text-sbi-dark font-semibold"
                    : "text-sbi-muted hover:text-white hover:bg-white/[0.06]",
                )}
              >
                {item}
              </button>
            ),
          )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            "p-1.5 rounded-lg text-sbi-muted hover:text-white hover:bg-white/[0.06] transition-colors",
            currentPage === totalPages &&
              "opacity-30 cursor-not-allowed pointer-events-none",
          )}
        >
          <CaretRightIcon size={14} />
        </button>
      </div>
    </div>
  );
}
