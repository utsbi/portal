import { Buffer } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  providerSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.providerSend };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn(async () => ({ data: [], error: null })),
    })),
  })),
}));

const { buildEventIcs, eventIcsFilename } = await import("@/lib/calendar/ics");
const { calendarEmailEnabled, emailNotificationEnabled, sendEmail } =
  await import("@/lib/email/send");
const { accountInviteHtml, accountInviteText } = await import(
  "@/lib/email/templates/account-invite"
);
const { eventInviteHtml, eventInviteText } = await import(
  "@/lib/email/templates/event-invite"
);
const { messageNotificationHtml, messageNotificationText } = await import(
  "@/lib/email/templates/message-notification"
);
const { requestUpdateHtml, requestUpdateText } = await import(
  "@/lib/email/templates/request-update"
);

describe("transactional email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "SBI Portal <notifications@utsbi.org>";
    mocks.providerSend.mockResolvedValue({
      data: { id: "email-123" },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends both HTML and text with an idempotency key", async () => {
    const id = await sendEmail({
      to: "recipient@example.com",
      subject: "Project update",
      html: "<p>Updated</p>",
      text: "Updated",
      idempotencyKey: "project-update/123",
      attachments: [{ filename: "event.ics", content: "YmVnaW4=" }],
    });

    expect(id).toBe("email-123");
    expect(mocks.providerSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "SBI Portal <notifications@utsbi.org>",
        to: ["recipient@example.com"],
        html: "<p>Updated</p>",
        text: "Updated",
        attachments: [{ filename: "event.ics", content: "YmVnaW4=" }],
      }),
      { idempotencyKey: "project-update/123" },
    );
  });

  it("fails closed when the provider key is absent", async () => {
    delete process.env.RESEND_API_KEY;
    await expect(
      sendEmail({
        to: "recipient@example.com",
        subject: "Hello",
        html: "<p>Hello</p>",
        text: "Hello",
        idempotencyKey: "hello/123",
      }),
    ).rejects.toThrow(/RESEND_API_KEY/);
    expect(mocks.providerSend).not.toHaveBeenCalled();
  });

  it("retries a transient provider failure with the same request", async () => {
    vi.useFakeTimers();
    mocks.providerSend
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "Slow down",
          name: "rate_limit_exceeded",
          statusCode: 429,
        },
      })
      .mockResolvedValueOnce({ data: { id: "email-456" }, error: null });

    const delivery = sendEmail({
      to: "recipient@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
      idempotencyKey: "hello/456",
    });
    await vi.runAllTimersAsync();

    await expect(delivery).resolves.toBe("email-456");
    expect(mocks.providerSend).toHaveBeenCalledTimes(2);
    expect(mocks.providerSend.mock.calls[0]).toEqual(
      mocks.providerSend.mock.calls[1],
    );
  });
});

describe("calendar downloads", () => {
  it("uses a readable title and date in the attachment filename", () => {
    expect(
      eventIcsFilename({
        title: "Sprint review: August!",
        startAt: "2026-08-11T14:00:00.000Z",
      }),
    ).toBe("sbi-sprint-review-august-2026-08-11.ics");
  });
});

describe("email content", () => {
  it("honors an explicit calendar notification opt-out", () => {
    expect(calendarEmailEnabled(undefined)).toBe(true);
    expect(calendarEmailEnabled({ notifications: { calendar: true } })).toBe(
      true,
    );
    expect(calendarEmailEnabled({ notifications: { calendar: false } })).toBe(
      false,
    );
  });

  it("honors message and request notification preferences", () => {
    expect(emailNotificationEnabled(undefined, "messages")).toBe(true);
    expect(
      emailNotificationEnabled(
        { notifications: { messages: false } },
        "messages",
      ),
    ).toBe(false);
    expect(
      emailNotificationEnabled(
        { notifications: { requests: false } },
        "requests",
      ),
    ).toBe(false);
  });

  it("escapes user-controlled HTML while retaining readable text", () => {
    const props = {
      recipientName: "<Admin>",
      eventTitle: "Review & approve",
      eventDate: "Tuesday, July 21, 2026",
      eventTime: "2:00 PM – 3:00 PM CDT",
      eventLocation: "Room <1>",
      eventDescription: "Discuss > decide",
      organizerName: "A&B",
      projectName: "SBI",
      portalUrl: "https://portal.example.com/dashboard/calendar?event=1&x=2",
    };

    const html = eventInviteHtml(props);
    expect(html).toContain("&lt;Admin&gt;");
    expect(html).toContain("Review &amp; approve");
    expect(html).not.toContain("Room <1>");
    expect(eventInviteText(props)).toContain("Room <1>");
  });

  it("renders a one-time account invitation in HTML and plain text", () => {
    const props = {
      recipientName: "Alex",
      invitedByName: "Jordan",
      roleLabel: "a client",
      inviteUrl:
        "https://portal.example.com/auth/confirm?token_hash=secret&type=invite",
    };

    expect(accountInviteHtml(props)).toContain("Create password");
    expect(accountInviteText(props)).toContain(props.inviteUrl);
    expect(accountInviteText(props)).not.toContain("<html>");
  });

  it("renders escaped message and request emails with portal links", () => {
    const message = {
      recipientName: "Alex",
      senderName: "Jordan <SBI>",
      excerpt: "Please review <this> before Friday.",
      portalUrl: "https://portal.example.com/dashboard/messages/42",
    };
    const request = {
      recipientName: "Alex",
      requestSubject: "Review <drawing>",
      status: "In progress",
      projectName: "Acme",
      portalUrl: "https://portal.example.com/dashboard/requests",
    };

    expect(messageNotificationHtml(message)).toContain("Jordan &lt;SBI&gt;");
    expect(messageNotificationHtml(message)).not.toContain("<this>");
    expect(messageNotificationText(message)).toContain(message.portalUrl);
    expect(requestUpdateHtml(request)).toContain("Review &lt;drawing&gt;");
    expect(requestUpdateText(request)).toContain(request.portalUrl);
  });

  it("builds an escaped, stable all-day calendar attachment", () => {
    const ics = buildEventIcs({
      id: 42,
      title: "Review, approve; ship",
      projectName: "Acme",
      description: "Line one\nLine two",
      location: null,
      startAt: "2026-07-21T00:00:00.000Z",
      endAt: "2026-07-22T00:00:00.000Z",
      allDay: true,
      versionAt: "2026-07-20T12:30:00.000Z",
      method: "REQUEST",
      status: "CONFIRMED",
    });

    expect(ics).toContain("DTSTAMP:20260720T123000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260721");
    expect(ics).toContain("SUMMARY:Acme: Review\\, approve\\; ship");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
    expect(Buffer.from(ics).toString("utf8")).toBe(ics);
  });
});
