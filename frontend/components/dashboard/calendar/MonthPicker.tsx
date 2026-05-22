"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { monthNames, monthShortNames } from "./utils";

interface Props {
  currentMonth: Date;
  onPick: (month: Date) => void;
}

export function MonthPicker({ currentMonth, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() =>
    currentMonth.getFullYear(),
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open) setPickerYear(currentMonth.getFullYear());
    setOpen((v) => !v);
  };

  const pick = (monthIndex: number) => {
    onPick(new Date(pickerYear, monthIndex, 1));
    setOpen(false);
  };

  const label = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-lg font-light tabular-nums text-white transition-colors hover:text-sbi-green cursor-pointer"
      >
        {label}
        <ChevronDown
          className={[
            "size-3.5 text-sbi-muted-dark transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-sbi-dark-border bg-sbi-dark-card p-3 shadow-2xl shadow-black/40">
          <div className="mb-3 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setPickerYear((y) => y - 1)}
              aria-label="Previous year"
              className="inline-flex size-7 items-center justify-center rounded-md text-sbi-muted hover:bg-sbi-dark/50 hover:text-sbi-green transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium tabular-nums text-white">
              {pickerYear}
            </span>
            <button
              type="button"
              onClick={() => setPickerYear((y) => y + 1)}
              aria-label="Next year"
              className="inline-flex size-7 items-center justify-center rounded-md text-sbi-muted hover:bg-sbi-dark/50 hover:text-sbi-green transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {monthShortNames.map((label, i) => {
              const isCurrent =
                pickerYear === currentMonth.getFullYear() &&
                i === currentMonth.getMonth();
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => pick(i)}
                  className={[
                    "rounded-md py-2 text-xs font-medium transition-colors border",
                    isCurrent
                      ? "border-sbi-green/30 bg-sbi-green/10 text-sbi-green hover:bg-sbi-green/15"
                      : "border-transparent text-sbi-muted hover:bg-sbi-dark/60 hover:text-white",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
