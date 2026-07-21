import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  validAttendeeIds: [] as number[],
  eventInsertCalls: 0,
}));

vi.mock("@/lib/email/schedule", () => ({
  scheduleEmailTask: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({
  sendEventInvites: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "auth-user" } },
        error: null,
      })),
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        const chain = {
          select: vi.fn(),
          eq: vi.fn(),
          single: vi.fn(async () => ({ data: { id: 10 }, error: null })),
        };
        chain.select.mockReturnValue(chain);
        chain.eq.mockReturnValue(chain);
        return chain;
      }

      if (table === "project_members") {
        const chain = {
          select: vi.fn(),
          eq: vi.fn(),
          in: vi.fn(async () => ({
            data: state.validAttendeeIds.map((profile_id) => ({ profile_id })),
            error: null,
          })),
          maybeSingle: vi.fn(async () => ({
            data: { role: "member" },
            error: null,
          })),
        };
        chain.select.mockReturnValue(chain);
        chain.eq.mockReturnValue(chain);
        return chain;
      }

      if (table === "project_events") {
        return {
          insert: vi.fn(() => {
            state.eventInsertCalls++;
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: 1,
                    created_at: "2026-07-21T12:00:00.000Z",
                    updated_at: "2026-07-21T12:00:00.000Z",
                  },
                  error: null,
                })),
              })),
            };
          }),
        };
      }

      return {};
    }),
  })),
}));

const { POST } = await import("@/app/api/contact/calendar/client-events/route");

function eventRequest(attendeeIds: number[]): Request {
  return new Request(
    "https://portal.example.com/api/contact/calendar/client-events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: 7,
        title: "Design review",
        startAt: "2026-07-22T15:00:00.000Z",
        endAt: "2026-07-22T16:00:00.000Z",
        attendeeIds,
      }),
    },
  );
}

describe("calendar event creation attendee isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.validAttendeeIds = [];
    state.eventInsertCalls = 0;
  });

  it("rejects a profile that is not a member of the event project", async () => {
    state.validAttendeeIds = [20];
    const response = await POST(eventRequest([20, 999]));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Every attendee must be a member of this project",
    });
    expect(state.eventInsertCalls).toBe(0);
  });

  it("bounds attendee fan-out before any database mutation", async () => {
    const response = await POST(
      eventRequest(Array.from({ length: 51 }, (_, index) => index + 1)),
    );

    expect(response.status).toBe(400);
    expect(state.eventInsertCalls).toBe(0);
  });
});
