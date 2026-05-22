import type { RawCalendarEvent } from "./types";

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

export function generateDemoEvents(): RawCalendarEvent[] {
  const today = new Date();

  const seeds: Array<{
    offsetDays: number;
    startHour: number;
    durationMinutes: number;
    summary: string;
    location: string | null;
    description?: string;
    organizer: { name: string; email: string };
  }> = [
    {
      offsetDays: -9,
      startHour: 10,
      durationMinutes: 45,
      summary: "Kickoff with Architecture team",
      location: "ECJ 1.314, UT Austin",
      organizer: { name: "Pedro Guzman", email: "pedro.guzman@sbi-texas.edu" },
    },
    {
      offsetDays: -4,
      startHour: 14,
      durationMinutes: 60,
      summary: "Schematic design review",
      location: "Zoom",
      organizer: {
        name: "Christian Butler",
        email: "christian.butler@sbi-texas.edu",
      },
    },
    {
      offsetDays: 0,
      startHour: 11,
      durationMinutes: 30,
      summary: "Weekly progress check-in",
      location: "Zoom",
      description: "Standing 30-minute sync on milestones and blockers.",
      organizer: { name: "Brendan Lyon", email: "brendan.lyon@sbi-texas.edu" },
    },
    {
      offsetDays: 1,
      startHour: 9,
      durationMinutes: 90,
      summary: "Site walkthrough, north lot",
      location: "Mueller redevelopment, Austin TX",
      organizer: {
        name: "Kabir Muzumdar",
        email: "kabir.muzumdar@sbi-texas.edu",
      },
    },
    {
      offsetDays: 1,
      startHour: 13,
      durationMinutes: 60,
      summary: "Material selection workshop",
      location: "ECJ 1.314, UT Austin",
      organizer: {
        name: "Preston Vajdos",
        email: "preston.vajdos@sbi-texas.edu",
      },
    },
    {
      offsetDays: 1,
      startHour: 15,
      durationMinutes: 30,
      summary: "Energy modeling sync",
      location: "Zoom",
      organizer: { name: "Daniel Lam", email: "daniel.wingchi.lam@gmail.com" },
    },
    {
      offsetDays: 1,
      startHour: 16,
      durationMinutes: 45,
      summary: "Sponsorship briefing",
      location: null,
      organizer: { name: "Dev Shroff", email: "dev.shroff@sbi-texas.edu" },
    },
    {
      offsetDays: 4,
      startHour: 10,
      durationMinutes: 60,
      summary: "Structural engineering review",
      location: "Conference room B",
      organizer: {
        name: "Kabir Muzumdar",
        email: "kabir.muzumdar@sbi-texas.edu",
      },
    },
    {
      offsetDays: 8,
      startHour: 14,
      durationMinutes: 90,
      summary: "Mid-project review with client",
      location: "Client HQ, downtown Austin",
      description: "Walk through deliverables to date and align on next phase.",
      organizer: { name: "Sam Moran", email: "sam.moran@sbi-texas.edu" },
    },
    {
      offsetDays: 14,
      startHour: 11,
      durationMinutes: 60,
      summary: "Sustainability targets retrospective",
      location: "Zoom",
      organizer: { name: "Arianne Yude", email: "arianne.yude@sbi-texas.edu" },
    },
    {
      offsetDays: 21,
      startHour: 13,
      durationMinutes: 120,
      summary: "Pre-construction handoff",
      location: "ECJ 1.314, UT Austin",
      organizer: { name: "Pedro Guzman", email: "pedro.guzman@sbi-texas.edu" },
    },
  ];

  return seeds.map((seed, i) => {
    const base = addDays(today, seed.offsetDays);
    const start = atTime(base, seed.startHour);
    const end = new Date(start.getTime() + seed.durationMinutes * 60 * 1000);

    return {
      id: `demo-${i}`,
      summary: seed.summary,
      start: iso(start),
      end: iso(end),
      location: seed.location,
      description: seed.description ?? null,
      htmlLink: null,
      organizerName: seed.organizer.name,
      organizerEmail: seed.organizer.email,
      creatorName: seed.organizer.name,
      creatorEmail: seed.organizer.email,
    };
  });
}
