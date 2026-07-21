import type { EventsResponse } from "./types";

function atTime(baseDate: Date, hour: number, minute = 0): Date {
  const d = new Date(baseDate);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function iso(date: Date): string {
  return date.toISOString();
}

export function generateDemoEvents(): EventsResponse["events"] {
  const today = new Date();
  // Use a fixed fake organizer id so the UI can still gate edit/delete
  // affordances on organizerId.
  const directorId = 0;

  const seeds: Array<{
    offsetDays: number;
    startHour: number;
    durationMinutes: number;
    title: string;
    location: string | null;
    description?: string;
    organizer: { name: string };
  }> = [
    {
      offsetDays: -9,
      startHour: 10,
      durationMinutes: 45,
      title: "Kickoff with Architecture team",
      location: "ECJ 1.314, UT Austin",
      organizer: { name: "Pedro Guzman" },
    },
    {
      offsetDays: -4,
      startHour: 14,
      durationMinutes: 60,
      title: "Schematic design review",
      location: "Zoom",
      organizer: { name: "Christian Butler" },
    },
    {
      offsetDays: 0,
      startHour: 11,
      durationMinutes: 30,
      title: "Weekly progress check-in",
      location: "Zoom",
      description: "Standing 30-minute sync on milestones and blockers.",
      organizer: { name: "Brendan Lyon" },
    },
    {
      offsetDays: 1,
      startHour: 9,
      durationMinutes: 90,
      title: "Site walkthrough, north lot",
      location: "Mueller redevelopment, Austin TX",
      organizer: { name: "Kabir Muzumdar" },
    },
    {
      offsetDays: 1,
      startHour: 13,
      durationMinutes: 60,
      title: "Material selection workshop",
      location: "ECJ 1.314, UT Austin",
      organizer: { name: "Preston Vajdos" },
    },
    {
      offsetDays: 1,
      startHour: 15,
      durationMinutes: 30,
      title: "Energy modeling sync",
      location: "Zoom",
      organizer: { name: "Daniel Lam" },
    },
    {
      offsetDays: 1,
      startHour: 16,
      durationMinutes: 45,
      title: "Sponsorship briefing",
      location: null,
      organizer: { name: "Dev Shroff" },
    },
    {
      offsetDays: 4,
      startHour: 10,
      durationMinutes: 60,
      title: "Structural engineering review",
      location: "Conference room B",
      organizer: { name: "Kabir Muzumdar" },
    },
    {
      offsetDays: 8,
      startHour: 14,
      durationMinutes: 90,
      title: "Mid-project review with client",
      location: "Client HQ, downtown Austin",
      description: "Walk through deliverables to date and align on next phase.",
      organizer: { name: "Sam Moran" },
    },
    {
      offsetDays: 14,
      startHour: 11,
      durationMinutes: 60,
      title: "Sustainability targets retrospective",
      location: "Zoom",
      organizer: { name: "Arianne Yude" },
    },
    {
      offsetDays: 21,
      startHour: 13,
      durationMinutes: 120,
      title: "Pre-construction handoff",
      location: "ECJ 1.314, UT Austin",
      organizer: { name: "Pedro Guzman" },
    },
  ];

  return seeds.map((seed, i) => {
    const base = addDays(today, seed.offsetDays);
    const start = atTime(base, seed.startHour);
    const end = new Date(start.getTime() + seed.durationMinutes * 60 * 1000);

    return {
      id: `demo-${i}`,
      title: seed.title,
      start: iso(start),
      end: iso(end),
      allDay: false,
      location: seed.location,
      description: seed.description ?? null,
      organizer: seed.organizer.name,
      organizerId: directorId,
      myResponse: i % 3 === 0 ? "accepted" : "needsAction",
    };
  });
}
