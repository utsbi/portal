"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  AgendaView,
  CalendarHeader,
  eventMatchesSearch,
  FetchErrorState,
  LoadingState,
  MonthView,
  NoDirectorConnectedState,
  NoEventsState,
  useCalendarEvents,
  useCalendarViewState,
} from "@/components/dashboard/calendar";
import { DashboardShell, PageHeader } from "@/components/dashboard/common/ui";
import { useProject } from "@/lib/project/project-context";

function CalendarPageInner() {
  const { activeProject } = useProject();
  const searchParams = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";

  const { view, selectedDate, setView, setSelectedDate } =
    useCalendarViewState();
  const [search, setSearch] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return new Date(`${selectedDate}T00:00:00`);
    }
    return new Date();
  });

  const { events, rawById, loading, refetching, error, connected, refetch } =
    useCalendarEvents({
      projectId: activeProject?.projectId,
      demoMode,
    });

  const projectLabel = activeProject?.companyName ?? "Project";

  // For Month view, when a search is active, filter events to keep snippet
  // counts honest. Agenda runs its own search filter internally.
  const monthEvents = useMemo(() => {
    if (!search.trim()) return events;
    return events.filter((e) => eventMatchesSearch(e, search));
  }, [events, search]);

  const subtitle = useMemo(() => {
    const parts: string[] = [`Upcoming meetings for ${projectLabel}`];
    if (events.length > 0) {
      const now = new Date();
      const thisMonth = events.filter((e) => {
        if (!e.start) return false;
        const d = new Date(e.start);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth()
        );
      }).length;
      if (thisMonth > 0) {
        parts.push(
          `${thisMonth} ${thisMonth === 1 ? "meeting" : "meetings"} this month`,
        );
      }
      const lastContact = events
        .filter((e) => e.past && e.start)
        .sort(
          (a, b) =>
            new Date(b.start as string).getTime() -
            new Date(a.start as string).getTime(),
        )[0];
      if (lastContact?.start) {
        const d = new Date(lastContact.start);
        const label = d.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        });
        parts.push(`last contact ${label}`);
      }
    }
    return parts.join(" · ");
  }, [events, projectLabel]);

  let body: React.ReactNode;
  if (loading && events.length === 0) {
    body = <LoadingState />;
  } else if (error && events.length === 0) {
    body = <FetchErrorState onRetry={refetch} />;
  } else if (!demoMode && connected === false) {
    body = <NoDirectorConnectedState />;
  } else if (events.length === 0) {
    body = <NoEventsState />;
  } else if (view === "agenda") {
    body = (
      <AgendaView
        events={events}
        rawById={rawById}
        search={search}
        scrollToDate={selectedDate}
      />
    );
  } else {
    body = (
      <MonthView
        events={monthEvents}
        rawById={rawById}
        currentMonth={currentMonth}
        onChangeMonth={setCurrentMonth}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />
    );
  }

  return (
    <DashboardShell>
      <PageHeader title="Calendar" subtitle={subtitle} />

      {refetching ? (
        <div
          className="mb-3 h-px w-full overflow-hidden bg-sbi-dark-border/30"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-[pulse_1.4s_ease-in-out_infinite] bg-sbi-green/40" />
        </div>
      ) : null}

      <CalendarHeader
        view={view}
        onViewChange={setView}
        search={search}
        onSearchChange={setSearch}
      />

      <div className="flex-1 min-h-0 flex flex-col">{body}</div>
    </DashboardShell>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <CalendarPageInner />
    </Suspense>
  );
}
