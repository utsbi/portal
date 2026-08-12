"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DatePicker,
  TimeInput,
} from "@/components/dashboard/common/DateTimePicker";
import {
  btnGhost,
  btnPrimary,
  Modal,
  TextField,
} from "@/components/dashboard/common/ui";
import { cn } from "@/lib/utils";
import { formatDateKey } from "./utils";

export interface EventFormValue {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
}

export interface EventFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  eventId?: string;
  projectId?: number;
  organizerProfileId?: number | null;
  initialValue?: Partial<EventFormValue>;
  onClose: () => void;
  onSaved: () => void;
}

interface ProjectMember {
  id: number;
  name: string;
  role: "client" | "director" | "president" | "member";
}

interface DateTimeParts {
  date: string;
  time: string;
}

export function EventFormModal({
  open,
  mode,
  eventId,
  projectId,
  organizerProfileId,
  initialValue,
  onClose,
  onSaved,
}: EventFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [start, setStart] = useState<DateTimeParts>(() => defaultStart());
  const [end, setEnd] = useState<DateTimeParts>(() =>
    defaultEnd(defaultStart()),
  );
  const [allDay, setAllDay] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<number[]>([]);
  const [initialAttendeeIds, setInitialAttendeeIds] = useState<number[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const isAllDay = initialValue?.allDay ?? false;
    const initialStart = toDateTimeParts(initialValue?.startAt, defaultStart());
    const initialEnd = toDateTimeParts(
      initialValue?.endAt,
      defaultEnd(initialStart),
      isAllDay,
    );
    setTitle(initialValue?.title ?? "");
    setDescription(initialValue?.description ?? "");
    setLocation(initialValue?.location ?? "");
    setStart(initialStart);
    setEnd(initialEnd);
    setAllDay(isAllDay);
    setSelectedAttendeeIds([]);
    setInitialAttendeeIds([]);
    setDatePickerOpen(false);
    setError(null);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setMembersLoading(true);
    setMembersError(null);
    const loadMembers = async () => {
      const response = await fetch(
        `/api/contact/calendar/project-members?project_id=${projectId}`,
      );
      const body = (await response.json().catch(() => ({}))) as {
        members?: ProjectMember[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error ?? "Couldn't load project members");
      return body.members ?? [];
    };
    const loadAttendees = async () => {
      if (mode !== "edit" || !eventId) return [];
      const response = await fetch(
        `/api/contact/calendar/client-events/${eventId}/attendees`,
      );
      const body = (await response.json().catch(() => ({}))) as {
        profileIds?: number[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error ?? "Couldn't load event members");
      return body.profileIds ?? [];
    };
    Promise.all([loadMembers(), loadAttendees()])
      .then(([projectMembers, attendeeIds]) => {
        if (cancelled) return;
        setMembers(projectMembers);
        const ids = Array.from(
          new Set(
            organizerProfileId
              ? [...attendeeIds, organizerProfileId]
              : attendeeIds,
          ),
        );
        setInitialAttendeeIds(ids);
        setSelectedAttendeeIds(ids);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setMembers([]);
          setMembersError(
            fetchError instanceof Error
              ? fetchError.message
              : "Couldn't load project members",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, projectId, eventId, organizerProfileId]);

  const toggleAttendee = (profileId: number) => {
    setSelectedAttendeeIds((current) =>
      current.includes(profileId)
        ? current.filter((id) => id !== profileId)
        : [...current, profileId],
    );
  };

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    const startAt = toIso(start);
    const endAt = allDay ? toAllDayEndIso(end.date) : toIso(end);
    if (
      !startAt ||
      !endAt ||
      new Date(endAt).getTime() <= new Date(startAt).getTime()
    ) {
      setError(
        allDay
          ? "End date must be on or after the start date"
          : "End must be after start",
      );
      return;
    }

    setBusy(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        startAt,
        endAt,
        allDay,
      };
      const url =
        mode === "create"
          ? "/api/contact/calendar/client-events"
          : `/api/contact/calendar/client-events/${eventId}`;
      const finalBody =
        mode === "create"
          ? { ...body, projectId, attendeeIds: selectedAttendeeIds }
          : body;
      const response = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalBody),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Couldn't save the event");
      }
      if (mode === "edit" && eventId) {
        const protectedIds = new Set(
          organizerProfileId ? [organizerProfileId] : [],
        );
        const nextIds = selectedAttendeeIds.filter(
          (profileId) => !protectedIds.has(profileId),
        );
        const priorIds = initialAttendeeIds.filter(
          (profileId) => !protectedIds.has(profileId),
        );
        const inviteIds = nextIds.filter(
          (profileId) => !priorIds.includes(profileId),
        );
        const removeIds = priorIds.filter(
          (profileId) => !nextIds.includes(profileId),
        );
        const memberChanges = [
          ...(inviteIds.length
            ? [
                fetch(
                  `/api/contact/calendar/client-events/${eventId}/attendees`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ profileIds: inviteIds }),
                  },
                ),
              ]
            : []),
          ...removeIds.map((profileId) =>
            fetch(`/api/contact/calendar/client-events/${eventId}/attendees`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ profileId }),
            }),
          ),
        ];
        const memberResponses = await Promise.all(memberChanges);
        const failedResponse = memberResponses.find((item) => !item.ok);
        if (failedResponse) {
          const payload = (await failedResponse.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(
            `Event saved, but member changes couldn't be completed: ${payload.error ?? "Please try again"}`,
          );
        }
      }
      onSaved();
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Couldn't save the event",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      opened={open}
      onClose={onClose}
      title={mode === "create" ? "New event" : "Edit event"}
      size="md"
      contentClassName={datePickerOpen ? "overflow-visible" : undefined}
      bodyClassName={cn("p-5", datePickerOpen && "overflow-visible")}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={cn(btnGhost, "h-9 px-4 text-xs")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className={cn(btnPrimary, "h-9 px-4 text-xs")}
          >
            {busy ? "Saving…" : mode === "create" ? "Create event" : "Save"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="e.g. Weekly progress check-in"
          autoFocus
        />

        <div className="flex items-center justify-between rounded-md border border-sbi-dark-border/50 bg-sbi-dark/30 px-3 py-2">
          <p className="text-sm text-white">All-day event</p>
          <button
            type="button"
            role="switch"
            aria-checked={allDay}
            onClick={() => setAllDay((current) => !current)}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              allDay ? "bg-sbi-green/70" : "bg-sbi-dark-border/60",
            )}
          >
            <span
              className={cn(
                "inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
                allDay ? "translate-x-[1.125rem]" : "translate-x-[0.1875rem]",
              )}
            />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeField
            label="Starts"
            value={start}
            onChange={setStart}
            timeDisabled={allDay}
            onDatePickerOpenChange={setDatePickerOpen}
          />
          <DateTimeField
            label="Ends"
            value={end}
            onChange={setEnd}
            timeDisabled={allDay}
            onDatePickerOpenChange={setDatePickerOpen}
          />
        </div>

        <fieldset className="rounded-md border border-sbi-dark-border/50 bg-sbi-dark/30 p-3">
          <legend className="px-1 text-xs uppercase tracking-[0.15em] text-sbi-muted">
            {mode === "create" ? "Invite project members" : "Event members"}
          </legend>
          <p className="mb-2 text-xs leading-relaxed text-sbi-muted">
            {mode === "create"
              ? "Selected people receive an event invitation email."
              : "Newly added people receive an event invitation email."}
          </p>
          {membersLoading ? (
            <p className="text-sm text-sbi-muted">Loading project members…</p>
          ) : null}
          {membersError ? (
            <p className="text-sm text-red-400">{membersError}</p>
          ) : null}
          {!membersLoading && !membersError ? (
            <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
              {members.map((member) => {
                const isOrganizer = member.id === organizerProfileId;
                const selected =
                  isOrganizer || selectedAttendeeIds.includes(member.id);
                return (
                  <label
                    key={member.id}
                    className={cn(
                      "flex min-h-8 items-center gap-3 rounded px-2 py-1 text-sm",
                      isOrganizer
                        ? "cursor-default text-sbi-muted"
                        : "cursor-pointer text-white hover:bg-white/[0.03]",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={isOrganizer}
                      onChange={() => toggleAttendee(member.id)}
                      className="size-3.5 accent-sbi-green disabled:opacity-60"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {member.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-sbi-muted-dark">
                      {isOrganizer ? "Organizer" : member.role}
                    </span>
                  </label>
                );
              })}
              {members.length === 0 ? (
                <p className="py-1 text-sm text-sbi-muted">
                  No other members are assigned to this project.
                </p>
              ) : null}
            </div>
          ) : null}
        </fieldset>

        <TextField
          label="Location"
          value={location}
          onChange={setLocation}
          placeholder="e.g. Zoom, ECJ 1.314"
        />
        <div>
          <label
            htmlFor="event-description"
            className="mb-2 block text-xs uppercase tracking-[0.15em] text-sbi-muted"
          >
            Description
          </label>
          <textarea
            id="event-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Agenda, dial-in, pre-reads…"
            className="w-full resize-none rounded-md border border-sbi-dark-border/50 bg-sbi-dark-card px-3 py-2 text-sm text-white transition-colors placeholder:text-sbi-muted-dark focus:border-sbi-green/50 focus:outline-none"
          />
        </div>
        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
  timeDisabled,
  onDatePickerOpenChange,
}: {
  label: string;
  value: DateTimeParts;
  onChange: (next: DateTimeParts) => void;
  timeDisabled: boolean;
  onDatePickerOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="block text-xs uppercase tracking-[0.15em] text-sbi-muted">
        {label}
      </span>
      <DatePicker
        value={value.date}
        onChange={(date) => onChange({ ...value, date })}
        onOpenChange={onDatePickerOpenChange}
      />
      {timeDisabled ? (
        <div className="flex h-9 items-center gap-2 rounded-md border border-sbi-dark-border/40 bg-sbi-dark/50 px-3 text-xs text-sbi-muted-dark">
          <Clock className="size-3.5" /> All day
        </div>
      ) : (
        <TimeInput
          value={value.time}
          onChange={(time) => onChange({ ...value, time })}
          ariaLabel={`${label} time`}
        />
      )}
    </div>
  );
}

function defaultStart(): DateTimeParts {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() < 30 ? 30 : 0);
  if (date.getMinutes() === 0) date.setHours(date.getHours() + 1);
  return dateToParts(date);
}

function defaultEnd(start: DateTimeParts): DateTimeParts {
  const date = new Date(`${start.date}T${start.time}`);
  date.setHours(date.getHours() + 1);
  return dateToParts(date);
}

function toDateTimeParts(
  value: string | undefined,
  fallback: DateTimeParts,
  allDayEnd = false,
): DateTimeParts {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  if (allDayEnd) date.setDate(date.getDate() - 1);
  return dateToParts(date);
}

function dateToParts(date: Date): DateTimeParts {
  return {
    date: formatDateKey(date),
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function toIso(value: DateTimeParts): string | null {
  const date = new Date(`${value.date}T${value.time}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toAllDayEndIso(inclusiveEndDate: string): string | null {
  const date = parseLocalDate(inclusiveEndDate);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}
