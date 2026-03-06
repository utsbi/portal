"use client";

import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";

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
            <p className="text-xs text-sbi-muted">
                Showing {startIndex}-{endIndex} of {totalItems}
            </p>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 border border-sbi-dark-border/50 rounded-lg hover:border-sbi-green/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <CaretLeftIcon size={16} className="text-white" weight="bold" />
                </button>
                <span className="text-xs text-sbi-muted px-3">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-sbi-dark-border/50 rounded-lg hover:border-sbi-green/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    <CaretRightIcon size={16} className="text-white" weight="bold" />
                </button>
            </div>
        </div>
    );
}
