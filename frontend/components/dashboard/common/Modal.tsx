"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
    opened: boolean;
    onClose: () => void;
    title?: ReactNode;
    /** Default true (label-style header). Set false for a literal value like a file name. */
    uppercaseTitle?: boolean;
    /** Rendered in the header row, between the title and the close button. */
    headerActions?: ReactNode;
    size?: "sm" | "md" | "lg" | "xl";
    padded?: boolean;
    hideClose?: boolean;
    contentClassName?: string;
    children: ReactNode;
}

const sizeToMaxWidth: Record<NonNullable<ModalProps["size"]>, string> = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-5xl",
};

const closeBtnClasses =
    "shrink-0 rounded-md p-1 bg-transparent text-sbi-muted hover:bg-sbi-green/10 hover:text-sbi-green transition-colors";

export function Modal({
    opened,
    onClose,
    title,
    uppercaseTitle = true,
    headerActions,
    size = "md",
    padded = true,
    hideClose = false,
    contentClassName,
    children,
}: ModalProps) {
    return (
        <Dialog.Root
            open={opened}
            onOpenChange={(o) => {
                if (!o) onClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-sbi-dark/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                <Dialog.Content
                    className={cn(
                        "font-urbanist",
                        "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full",
                        sizeToMaxWidth[size],
                        "bg-sbi-dark text-white border border-sbi-dark-border/50 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
                        "max-h-[88vh] flex flex-col",
                        "duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-98 data-[state=open]:zoom-in-98",
                        contentClassName,
                    )}
                >
                    {title ? (
                        <div className="bg-sbi-dark-card border-b border-sbi-dark-border/50 px-5 py-4 flex items-center gap-4 shrink-0">
                            <Dialog.Title
                                className={cn(
                                    "min-w-0 flex-1 truncate text-sm font-medium",
                                    uppercaseTitle
                                        ? "uppercase tracking-[0.04em] text-sbi-muted"
                                        : "text-white",
                                )}
                            >
                                {title}
                            </Dialog.Title>
                            {headerActions ? (
                                <div className="flex shrink-0 items-center gap-2">
                                    {headerActions}
                                </div>
                            ) : null}
                            {!hideClose ? (
                                <Dialog.Close
                                    aria-label="Close"
                                    className={closeBtnClasses}
                                >
                                    <X className="h-4 w-4" />
                                </Dialog.Close>
                            ) : null}
                        </div>
                    ) : (
                        <>
                            <Dialog.Title className="sr-only">
                                Dialog
                            </Dialog.Title>
                            {!hideClose ? (
                                <Dialog.Close
                                    aria-label="Close"
                                    className={cn(
                                        "absolute right-3 top-3 z-10",
                                        closeBtnClasses,
                                    )}
                                >
                                    <X className="h-4 w-4" />
                                </Dialog.Close>
                            ) : null}
                        </>
                    )}
                    <Dialog.Description className="sr-only">
                        Dialog content
                    </Dialog.Description>
                    <div
                        className={cn(
                            "flex-1 min-h-0 overflow-y-auto custom-scrollbar",
                            padded && "p-6",
                        )}
                    >
                        {children}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
