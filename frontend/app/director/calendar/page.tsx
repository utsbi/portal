"use client";

import React, { useEffect, useMemo, useState } from "react";

type CalendarItem = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
};

export default function DirectorCalendarPage() {
  const [calendars, setCalendars] = useState<CalendarItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCalendars = async () => {
      try {
        setLoading(true);
        setError("");
        setMessage("");

        const res = await fetch("/api/contact/calendar/client-events/list", {
          method: "GET",
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data?.error || "Failed to load calendars.");
          return;
        }

        const items: CalendarItem[] = Array.isArray(data?.calendars)
          ? data.calendars
          : [];

        setCalendars(items);

        const preferred =
          items.find((c) => c.summary?.trim().toLowerCase() === "sbi") ??
          items.find((c) => c.accessRole === "owner" && !c.primary) ??
          items.find((c) => c.primary) ??
          items[0];

        if (preferred) {
          setSelectedId(preferred.id);
        }
      } catch {
        setError("Something went wrong while loading calendars.");
      } finally {
        setLoading(false);
      }
    };

    loadCalendars();
  }, []);

  const selectedCalendar = useMemo(
    () => calendars.find((calendar) => calendar.id === selectedId) ?? null,
    [calendars, selectedId]
  );

  const handleConnectGoogle = () => {
    window.location.href = "/api/contact/auth/google";
  };

  const handleSave = async () => {
    if (!selectedId) {
      setError("Please select a calendar first.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const res = await fetch("/api/contact/calendar/client-events/select", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ calendarId: selectedId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to save calendar.");
        return;
      }

      setMessage("Calendar saved successfully.");
    } catch {
      setError("Something went wrong while saving the calendar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-black">
      <div className="mx-auto max-w-2xl rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Director Calendar Setup</h1>
        <p className="mt-2 text-sm text-black/70">
          Connect Google, load your available calendars, and choose which one
          SBI should use.
        </p>

        <div className="mt-6 rounded-xl border border-black/10 p-4">
          <h2 className="text-base font-medium">1. Connect Google Calendar</h2>
          <p className="mt-1 text-sm text-black/70">
            If you have not connected Google yet, do that first.
          </p>

          <button
            type="button"
            onClick={handleConnectGoogle}
            className="mt-4 rounded-xl border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black hover:text-white"
          >
            Connect Google
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-black/10 p-4">
          <h2 className="text-base font-medium">2. Choose Calendar</h2>
          <p className="mt-1 text-sm text-black/70">
            Select the calendar you want this director account to use.
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-black/70">Loading calendars...</p>
          ) : calendars.length === 0 ? (
            <p className="mt-4 text-sm text-red-600">
              No calendars found. Connect Google first, then refresh this page.
            </p>
          ) : (
            <>
              <label
                htmlFor="calendar-select"
                className="mt-4 block text-sm font-medium text-black"
              >
                Google calendar
              </label>

              <select
                id="calendar-select"
                name="calendar-select"
                aria-label="Google calendar"
                value={selectedId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSelectedId(e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-black/15 px-3 py-2 text-sm outline-none"
              >
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.summary}
                    {calendar.primary ? " (Primary)" : ""}
                    {calendar.accessRole ? ` — ${calendar.accessRole}` : ""}
                  </option>
                ))}
              </select>

              {selectedCalendar && (
                <div className="mt-4 rounded-xl bg-black/[0.03] p-3 text-sm">
                  <p>
                    <span className="font-medium">Selected:</span>{" "}
                    {selectedCalendar.summary}
                  </p>
                  <p className="mt-1 break-all text-black/70">
                    {selectedCalendar.id}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !selectedId}
                className="mt-4 rounded-xl border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Calendar"}
              </button>
            </>
          )}
        </div>

        {message ? (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </main>
  );
}