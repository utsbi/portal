"use client";

import { useEffect, useState } from "react";
import {
  btnGhost,
  btnPrimary,
  inputClass,
  Modal,
  TextField,
} from "@/components/dashboard/common/ui";
import { cn } from "@/lib/utils";

export interface EventFormValue {
  title: string;
  description: string;
  location: string;
  /** ISO string (local) — the form keeps it as a `YYYY-MM-DDTHH:mm` string. */
  startAt: string;
  endAt: string;
  allDay: boolean;
}

export interface EventFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  /** When editing, the existing event's id. */
  eventId?: string;
  /** Project the new event belongs to (create mode only). */
  projectId?: number;
  initialValue?: Partial<EventFormValue>;
  /** Member ids to invite as attendees (create mode only). */
  attendeeIds?: number[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Create / edit an event. The form holds everything as `string` so the
 * controlled inputs stay simple. On submit we serialize to ISO and POST
 * or PATCH the appropriate endpoint.
 */
export function EventFormModal({
  open,
  mode,
  eventId,
  projectId,
  initialValue,
  attendeeIds = [],
  onClose,
  onSaved,
}: EventFormModalProps) {
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [description, setDescription] = useState(
    initialValue?.description ?? "",
  );
  const [location, setLocation] = useState(initialValue?.location ?? "");
  const [startAt, setStartAt] = useState(
    initialValue?.startAt ?? defaultStart(),
  );
  const [endAt, setEndAt] = useState(
    initialValue?.endAt ?? defaultEnd(initialValue?.startAt ?? defaultStart()),
  );
  const [allDay, setAllDay] = useState(initialValue?.allDay ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed when reopening (e.g. switching between create and edit on the
  // same modal instance).
  useEffect(() => {
    if (!open) return;
    setTitle(initialValue?.title ?? "");
    setDescription(initialValue?.description ?? "");
    setLocation(initialValue?.location ?? "");
    const s = initialValue?.startAt ?? defaultStart();
    setStartAt(s);
    setEndAt(initialValue?.endAt ?? defaultEnd(s));
    setAllDay(initialValue?.allDay ?? false);
    setError(null);
  }, [open, initialValue]);

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
      setError("End must be after start");
      return;
    }
    setBusy(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        allDay,
      };
      const url =
        mode === "create"
          ? "/api/contact/calendar/client-events"
          : `/api/contact/calendar/client-events/${eventId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const finalBody =
        mode === "create" ? { ...body, projectId, attendeeIds } : body;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalBody),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Couldn't save the event");
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the event");
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="event-start"
              className="block text-xs uppercase tracking-[0.15em] text-sbi-muted mb-2"
            >
              Starts
            </label>
            <input
              id="event-start"
              type={allDay ? "date" : "datetime-local"}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="event-end"
              className="block text-xs uppercase tracking-[0.15em] text-sbi-muted mb-2"
            >
              Ends
            </label>
            <input
              id="event-end"
              type={allDay ? "date" : "datetime-local"}
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-sbi-muted">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="accent-sbi-green"
          />
          All-day event
        </label>

        <TextField
          label="Location"
          value={location}
          onChange={setLocation}
          placeholder="e.g. Zoom, ECJ 1.314, …"
        />

        <div>
          <label
            htmlFor="event-description"
            className="block text-xs uppercase tracking-[0.15em] text-sbi-muted mb-2"
          >
            Description
          </label>
          <textarea
            id="event-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Agenda, dial-in, pre-reads…"
            className="w-full bg-sbi-dark-card text-white border border-sbi-dark-border/50 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-sbi-green/50 transition-colors placeholder:text-sbi-muted-dark resize-none"
          />
        </div>

        {error ? <p className="text-xs text-red-400">{error}</p> : null}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Default start: now rounded up to the next half hour, in local time. */
function defaultStart(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  if (m < 30) d.setMinutes(30);
  else {
    d.setMinutes(0);
    d.setHours(d.getHours() + 1);
  }
  return toLocalInputValue(d);
}

/** Default end: start + 1 hour. */
function defaultEnd(startValue: string): string {
  const d = new Date(startValue);
  d.setHours(d.getHours() + 1);
  return toLocalInputValue(d);
}

/** Format a Date as the `YYYY-MM-DDTHH:mm` value expected by datetime-local. */
function toLocalInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}
