"use client";

import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  AgendaView,
  type CalendarEvent,
  CalendarHeader,
  EventFormModal,
  type EventFormValue,
  eventMatchesSearch,
  FetchErrorState,
  LoadingState,
  MonthView,
  NoEventsState,
  useCalendarEvents,
  useCalendarViewState,
} from "@/components/dashboard/calendar";
import {
  btnPrimary,
  DashboardMain,
  DashboardShell,
  PageHeader,
} from "@/components/dashboard/common/ui";
import { toastError, toastSuccess } from "@/lib/notifications";
import { useProject } from "@/lib/project/project-context";

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function eventToFormValue(event: CalendarEvent): EventFormValue {
  return {
    title: event.title,
    description: event.description ?? "",
    location: event.location ?? "",
    startAt: isoToLocalInput(event.start),
    endAt: isoToLocalInput(event.end),
    allDay: event.allDay,
  };
}

function CalendarPageInner() {
  const { activeProject, user } = useProject();
  const searchParams = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";
  const currentProfileId = user?.id ?? null;

  const { view, selectedDate, setView, setSelectedDate } =
    useCalendarViewState();
  const [search, setSearch] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return new Date(`${selectedDate}T00:00:00`);
    }
    return new Date();
  });

  const { events, loading, refetching, error, refetch, rsvp } =
    useCalendarEvents({
      projectId: activeProject?.projectId,
      demoMode,
    });

  const [formState, setFormState] = useState<
    | { open: false }
    | { open: true; mode: "create"; initial: EventFormValue }
    | {
        open: true;
        mode: "edit";
        event: CalendarEvent;
        initial: EventFormValue;
      }
  >({ open: false });

  const projectLabel = activeProject?.companyName ?? "Project";

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

  const monthEvents = useMemo(() => {
    if (!search.trim()) return events;
    return events.filter((e) => eventMatchesSearch(e, search));
  }, [events, search]);

  const handleRsvp = async (
    eventId: string,
    response: "accepted" | "declined" | "tentative",
  ) => {
    try {
      await rsvp(eventId, response);
    } catch (e) {
      toastError(
        e instanceof Error ? e.message : "Couldn't save your response",
      );
    }
  };

  const handleDelete = async (event: CalendarEvent) => {
    if (!window.confirm(`Delete "${event.title}"? This can't be undone.`))
      return;
    try {
      const res = await fetch(
        `/api/contact/calendar/client-events/${event.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Couldn't delete the event");
      }
      toastSuccess("Event deleted");
      refetch();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Couldn't delete the event");
    }
  };

  let body: React.ReactNode;
  if (loading && events.length === 0) {
    body = <LoadingState />;
  } else if (error && events.length === 0) {
    body = <FetchErrorState onRetry={refetch} />;
  } else if (events.length === 0) {
    body = <NoEventsState />;
  } else if (view === "agenda") {
    body = (
      <AgendaView
        events={events}
        search={search}
        scrollToDate={selectedDate}
        currentProfileId={currentProfileId}
        onRsvp={handleRsvp}
        onEdit={(e) =>
          setFormState({
            open: true,
            mode: "edit",
            event: e,
            initial: eventToFormValue(e),
          })
        }
        onDelete={handleDelete}
      />
    );
  } else {
    body = (
      <MonthView
        events={monthEvents}
        currentMonth={currentMonth}
        onChangeMonth={setCurrentMonth}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        currentProfileId={currentProfileId}
        onRsvp={handleRsvp}
        onEdit={(e) =>
          setFormState({
            open: true,
            mode: "edit",
            event: e,
            initial: eventToFormValue(e),
          })
        }
        onDelete={handleDelete}
      />
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Calendar"
        subtitle={subtitle}
        action={
          activeProject ? (
            <button
              type="button"
              onClick={() =>
                setFormState({
                  open: true,
                  mode: "create",
                  initial: {
                    title: "",
                    description: "",
                    location: "",
                    startAt: "",
                    endAt: "",
                    allDay: false,
                  },
                })
              }
              className={btnPrimary}
            >
              <Plus className="size-4" /> New event
            </button>
          ) : null
        }
      />

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

      <DashboardMain>{body}</DashboardMain>

      {formState.open ? (
        <EventFormModal
          open={formState.open}
          mode={formState.mode}
          eventId={formState.mode === "edit" ? formState.event.id : undefined}
          initialValue={formState.initial}
          attendeeIds={activeProject && user ? [user.id] : []}
          onClose={() => setFormState({ open: false })}
          onSaved={refetch}
        />
      ) : null}
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
