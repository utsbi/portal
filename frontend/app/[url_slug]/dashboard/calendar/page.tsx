"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CalendarEvent = {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  location: string | null;
  description: string | null;
  htmlLink: string | null;
};

export default function CalendarPage() {
  const supabase = useMemo(() => createClient(), []);

  const [clientId, setClientId] = useState<number | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async (cid: number) => {
    setRefreshing(true);
    setError(null);

    try {
      const res = await fetch(`/api/contact/calendar/client-events?client_id=${cid}`);
      const json = await res.json();

      if (!res.ok) {
        setEvents([]);
        setError(json?.error ?? "Failed to load events.");
        return;
      }

      setEvents(Array.isArray(json?.events) ? json.events : []);
    } catch (e: any) {
      setEvents([]);
      setError(e?.message ?? "Failed to load events.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        setError(authErr.message);
        setLoading(false);
        return;
      }
      if (!authData.user) {
        setError("Not logged in.");
        setLoading(false);
        return;
      }

      const { data: clientRow, error: clientErr } = await supabase
        .from("clients")
        .select("id, email")
        .eq("uid", authData.user.id)
        .single();

      if (clientErr) {
        setError(clientErr.message);
        setLoading(false);
        return;
      }

      if (!clientRow?.id) {
        setError("No client record found for this login (clients.uid not linked).");
        setLoading(false);
        return;
      }

      if (!clientRow?.email) {
        setError("Your client record is missing an email. Ask an admin to add it.");
        setLoading(false);
        return;
      }

      setClientId(clientRow.id);

      await loadEvents(clientRow.id);

      setLoading(false);
    };

    run();
  }, [supabase]);

  if (loading)
    return (
      <div className="min-h-screen bg-black text-white p-6">
        Loading your events…
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <span className="text-green-400">Calendar error:</span> {error}
      </div>
    );

  return (
    <div className="min-h-screen bg-black text-white flex justify-center py-10">
      <div className="w-full max-w-5xl px-2">
        <div className="rounded-2xl border border-green-500 bg-zinc-950 p-5 shadow-lg shadow-green-500/10">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold tracking-wide text-green-400">
              Your upcoming SBI events
            </h1>

            {clientId !== null && (
              <button
                className="text-sm text-green-400 hover:text-green-300 underline underline-offset-4 disabled:opacity-60"
                onClick={() => loadEvents(clientId)}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            )}
          </div>

          {events.length === 0 ? (
            <div className="mt-3 text-sm text-zinc-300">
              No events found yet. If you were just scheduled, make sure the director added your
              email as a guest on the Google Calendar event.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {events.map((event) => {
                const icsUrl =
                  `/api/contact/calendar/client-events/ics?` +
                  new URLSearchParams({
                    summary: event.summary ?? "SBI Event",
                    start: event.start ?? "",
                    end: event.end ?? "",
                    location: event.location ?? "",
                    description: event.description ?? "",
                  }).toString();

                return (
                  <li
                    key={event.id}
                    className="rounded-xl border border-green-500/80 bg-zinc-900 p-4"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="font-medium text-white">{event.summary}</div>

                      <div className="text-sm text-zinc-300">
                        {event.start ?? "—"} {event.end ? `→ ${event.end}` : ""}
                      </div>

                      {event.location && (
                        <div className="text-sm text-zinc-200">{event.location}</div>
                      )}

                      <div className="mt-2 flex flex-wrap gap-4 text-sm">
                        <a
                          href={icsUrl}
                          className="text-green-400 hover:text-green-300 underline underline-offset-4"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Add to Calendar (.ics)
                        </a>

                        {event.htmlLink && (
                          <a
                            href={event.htmlLink}
                            className="text-green-400 hover:text-green-300 underline underline-offset-4"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open in Google Calendar
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}