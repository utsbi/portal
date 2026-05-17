"use client";

import { createElement, type ReactNode } from "react";
import { toast } from "sonner";
import { Toast, type ToastKind } from "@/components/dashboard/common/Toast";

function show(
    kind: ToastKind,
    durationMs: number,
    message: ReactNode,
    title?: string,
) {
    toast.custom(
        () => createElement(Toast, { kind, title, message }),
        { duration: durationMs },
    );
}

export function toastSuccess(message: string, title?: string) {
    show("success", 4000, message, title);
}

export function toastError(message: ReactNode, title = "Something went wrong") {
    show("error", 6000, message, title);
}

export function toastInfo(message: string, title?: string) {
    show("info", 3500, message, title);
}

/**
 * Quiet one-line confirmation for a completed move with an inline Undo (the
 * only action, so it carries real contrast). The caller pre-humanizes any
 * error message. On undo: dismiss, await onUndo, then a follow-up toast.
 */
export function toastMoveUndo(
    name: string,
    destLabel: string,
    onUndo: () => Promise<void>,
): void {
    toast.custom(
        (id) =>
            createElement(Toast, {
                kind: "success",
                message: createElement(
                    "span",
                    { className: "flex items-center gap-3" },
                    createElement(
                        "span",
                        { className: "min-w-0 flex-1 leading-snug" },
                        createElement(
                            "span",
                            { className: "text-sbi-muted" },
                            "Moved ",
                        ),
                        createElement(
                            "span",
                            { className: "font-medium text-white" },
                            name,
                        ),
                        createElement(
                            "span",
                            { className: "text-sbi-muted" },
                            ` to ${destLabel}`,
                        ),
                    ),
                    createElement(
                        "button",
                        {
                            type: "button",
                            className:
                                "shrink-0 cursor-pointer rounded-md border border-sbi-green/30 px-2.5 py-1 text-xs font-medium text-sbi-green transition-colors hover:bg-sbi-green/10",
                            onClick: async () => {
                                toast.dismiss(id);
                                try {
                                    await onUndo();
                                    toastSuccess("Move undone.");
                                } catch (err) {
                                    const msg =
                                        err instanceof Error
                                            ? err.message
                                            : String(err);
                                    toastError(msg, "Undo failed");
                                }
                            },
                        },
                        "Undo",
                    ),
                ),
            }),
        { duration: 6000 },
    );
}
