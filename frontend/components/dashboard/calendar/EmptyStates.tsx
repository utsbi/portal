"use client";

import {
  AlertTriangle,
  CalendarClock,
  CalendarOff,
  RefreshCw,
} from "lucide-react";
import { EmptyState, btnPrimary } from "@/components/dashboard/common/ui";
import { cn } from "@/lib/utils";

export function NoDirectorConnectedState() {
  return (
    <EmptyState
      icon={<CalendarOff className="size-6" />}
      title="No calendar connected yet"
      description="Your director hasn't connected their calendar yet. Once they do, your meetings will appear here."
    />
  );
}

export function NoEventsState() {
  return (
    <EmptyState
      icon={<CalendarClock className="size-6" />}
      title="No events scheduled"
      description="Meetings your director adds you to will appear here."
    />
  );
}

interface FetchErrorProps {
  onRetry: () => void;
}

export function FetchErrorState({ onRetry }: FetchErrorProps) {
  return (
    <EmptyState
      icon={<AlertTriangle className="size-6" />}
      title="Couldn't load events"
      description="The calendar service didn't respond. Check your connection and try again."
      action={
        <button
          type="button"
          onClick={onRetry}
          className={cn(btnPrimary, "px-4 h-9")}
        >
          <RefreshCw className="size-3.5" />
          Try again
        </button>
      }
    />
  );
}

export function LoadingState() {
  return (
    <div className="flex-1 flex flex-col gap-6 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <div className="flex items-center gap-3 pb-2">
            <div className="h-3 w-16 rounded-sm bg-white/5" />
            <div className="h-3 w-24 rounded-sm bg-white/5" />
            <div className="flex-1 h-px bg-sbi-dark-border/40" />
          </div>
          <div className="rounded-lg border border-sbi-dark-border/30 bg-sbi-dark-card/30">
            {[0, 1].map((j) => (
              <div
                key={j}
                className="border-b border-sbi-dark-border/30 px-4 py-3 last:border-b-0"
              >
                <div className="h-3.5 w-3/5 rounded-sm bg-white/5 mb-2" />
                <div className="h-3 w-2/5 rounded-sm bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
