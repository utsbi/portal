import "server-only";

import { Resend } from "resend";
import { eventInviteHtml } from "@/lib/email/templates/event-invite";
import { createAdminClient } from "@/lib/supabase/admin";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

function createResendClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is not configured — email sending is disabled",
    );
  }
  return new Resend(RESEND_API_KEY);
}

const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "SBI Portal <notifications@utsbi.org>";

const PORTAL_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

/** Best-effort send via Resend. Silently no-ops if RESEND_API_KEY is unset. */
export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!RESEND_API_KEY) {
    console.warn("sendEmail skipped: RESEND_API_KEY not set");
    return;
  }

  const resend = createResendClient();
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });

  if (error) {
    console.error("sendEmail failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

interface SendInviteParams {
  eventId: number;
  projectName: string;
  eventTitle: string;
  eventStart: string;
  eventEnd: string;
  eventLocation: string | null;
  eventDescription: string | null;
  organizerName: string;
  attendeeProfileIds: number[];
}

/**
 * Fetch profiles for the given attendee IDs and send each an event-invite
 * email. All failures are logged; the caller succeeds regardless.
 */
export async function sendEventInvites(params: SendInviteParams) {
  if (!RESEND_API_KEY) return;

  const supabaseAdmin = createAdminClient();
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, name, email")
    .in("id", params.attendeeProfileIds);

  if (!profiles || profiles.length === 0) return;

  const startDate = new Date(params.eventStart);
  const endDate = new Date(params.eventEnd);
  const eventDate = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const eventTime = `${startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${endDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`;
  const allDay = startDate.getHours() === 0 && endDate.getHours() === 0;
  const displayTime = allDay ? "All day" : eventTime;

  const portalUrl = `${PORTAL_ORIGIN}/dashboard/calendar?event=${params.eventId}`;

  for (const profile of profiles) {
    if (!profile.email) continue;

    const html = eventInviteHtml({
      recipientName: profile.name,
      eventTitle: params.eventTitle,
      eventDate,
      eventTime: displayTime,
      eventLocation: params.eventLocation,
      eventDescription: params.eventDescription,
      organizerName: params.organizerName,
      projectName: params.projectName,
      portalUrl,
    });

    await sendEmail({
      to: profile.email,
      subject: `You're invited: ${params.eventTitle}`,
      html,
    });
  }
}

/**
 * Send an RSVP notification to the event organizer.
 */
export async function sendRsvpNotification(params: {
  organizerEmail: string;
  organizerName: string;
  attendeeName: string;
  eventTitle: string;
  eventDate: string;
  response: "accepted" | "declined" | "tentative";
  projectName: string;
  eventId: number;
}) {
  if (!RESEND_API_KEY) return;

  const { rsvpNotificationHtml } = await import(
    "@/lib/email/templates/rsvp-notification"
  );

  const responseLabels: Record<string, string> = {
    accepted: "accepted",
    declined: "declined",
    tentative: "tentatively accepted",
  };

  const html = rsvpNotificationHtml({
    organizerName: params.organizerName,
    attendeeName: params.attendeeName,
    eventTitle: params.eventTitle,
    eventDate: params.eventDate,
    response: params.response,
    projectName: params.projectName,
    portalUrl: `${PORTAL_ORIGIN}/dashboard/calendar?event=${params.eventId}`,
  });

  await sendEmail({
    to: params.organizerEmail,
    subject: `${params.attendeeName} ${responseLabels[params.response]} — ${params.eventTitle}`,
    html,
  });
}
