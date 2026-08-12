import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/components/dashboard/calendar/types";
import { eventDateKeys } from "@/components/dashboard/calendar/utils";

function event(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "event-1",
    title: "Project review",
    dateKey: "2026-08-10",
    prettyDate: "Aug 10, 2026",
    startTime: "09:00 AM",
    endTime: "10:00 AM",
    start: "2026-08-10T14:00:00.000Z",
    end: "2026-08-10T15:00:00.000Z",
    allDay: false,
    organizer: "Organizer",
    organizerId: 1,
    location: null,
    description: null,
    past: false,
    myResponse: "accepted",
    ...overrides,
  };
}

describe("eventDateKeys", () => {
  it("shows a timed event on each calendar day it spans", () => {
    expect(
      eventDateKeys(
        event({
          start: "2026-08-10T14:00:00.000Z",
          end: "2026-08-12T16:00:00.000Z",
        }),
      ),
    ).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
  });

  it("treats the all-day end timestamp as exclusive", () => {
    expect(
      eventDateKeys(
        event({
          allDay: true,
          start: "2026-08-10T05:00:00.000Z",
          end: "2026-08-13T05:00:00.000Z",
        }),
      ),
    ).toEqual(["2026-08-10", "2026-08-11", "2026-08-12"]);
  });
});
