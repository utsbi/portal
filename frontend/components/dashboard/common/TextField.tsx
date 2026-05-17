"use client";

import type { KeyboardEventHandler } from "react";

interface TextFieldProps {
    label?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
    type?: string;
}

export function TextField({
    label,
    value,
    onChange,
    placeholder,
    disabled,
    autoFocus,
    onKeyDown,
    type = "text",
}: TextFieldProps) {
    return (
        <div>
            {label ? (
                <label className="block text-xs uppercase tracking-[0.04em] text-sbi-muted mb-2">
                    {label}
                </label>
            ) : null}
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                // biome-ignore lint/a11y/noAutofocus: modal inputs need focus for Enter-to-submit
                autoFocus={autoFocus}
                onKeyDown={onKeyDown}
                className="w-full bg-sbi-dark-card text-white border border-sbi-dark-border/50 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-sbi-green/50 transition-colors disabled:opacity-50 placeholder:text-sbi-muted-dark"
            />
        </div>
    );
}
