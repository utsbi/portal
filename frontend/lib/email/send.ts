import "server-only";

import { Buffer } from "node:buffer";
import { Resend } from "resend";
import { buildEventIcs } from "@/lib/calendar/ics";
import {
  accountInviteHtml,
  accountInviteText,
} from "@/lib/email/templates/account-invite";
import {
  type EventChangeKind,
  eventChangeHtml,
  eventChangeText,
} from "@/lib/email/templates/event-change";
import {
  eventInviteHtml,
  eventInviteText,
} from "@/lib/email/templates/event-invite";
import {
  messageNotificationHtml,
  messageNotificationText,
} from "@/lib/email/templates/message-notification";
import {
  requestUpdateHtml,
  requestUpdateText,
} from "@/lib/email/templates/request-update";
import {
  rsvpNotificationHtml,
  rsvpNotificationText,
} from "@/lib/email/templates/rsvp-notification";
import { getPortalOrigin } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export { getPortalOrigin } from "@/lib/env/server";

const MAX_SEND_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 750];
const DEFAULT_TIME_ZONE = "America/Chicago";

interface EmailAttachment {
  content: string;
  filename: string;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  attachments?: EmailAttachment[];
}

interface ProviderError {
  message?: string;
  name?: string;
  statusCode?: number;
}

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  return {
    apiKey,
    from:
      process.env.EMAIL_FROM?.trim() || "SBI Portal <notifications@utsbi.org>",
  };
}

function getEmailTimeZone(): string {
  const configured = process.env.EMAIL_TIME_ZONE?.trim() || DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: configured }).format();
    return configured;
  } catch {
    console.warn(
      `Invalid EMAIL_TIME_ZONE "${configured}"; using ${DEFAULT_TIME_ZONE}`,
    );
    return DEFAULT_TIME_ZONE;
  }
}

export type EmailNotificationKind = "messages" | "calendar" | "requests";

export function emailNotificationEnabled(
  config: unknown,
  kind: EmailNotificationKind,
): boolean {
  if (!config || typeof config !== "object" || Array.isArray(config))
    return true;
  const notifications = (config as Record<string, unknown>).notifications;
  if (
    !notifications ||
    typeof notifications !== "object" ||
    Array.isArray(notifications)
  ) {
    return true;
  }
  return (notifications as Record<string, unknown>)[kind] !== false;
}

export function calendarEmailEnabled(config: unknown): boolean {
  return emailNotificationEnabled(config, "calendar");
}

function isRetryable(error: ProviderError): boolean {
  return (
    error.statusCode === 408 ||
    error.statusCode === 429 ||
    (typeof error.statusCode === "number" && error.statusCode >= 500) ||
    error.name === "application_error" ||
    error.name === "internal_server_error" ||
    error.name === "rate_limit_exceeded"
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Send a transactional email and fail loudly after bounded transient retries. */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
  attachments,
}: SendEmailOptions): Promise<string> {
  const { apiKey, from } = getEmailConfig();
  const resend = new Resend(apiKey);
  let lastError: ProviderError | null = null;

  for (let attempt = 0; attempt < MAX_SEND_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await resend.emails.send(
        {
          from,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
          text,
          attachments,
        },
        { idempotencyKey },
      );

      if (!error && data?.id) return data.id;

      const providerError: ProviderError = error
        ? {
            message: error.message,
            name: error.name,
            statusCode: error.statusCode ?? undefined,
          }
        : { message: "Email provider returned no message id" };
      lastError = providerError;
      if (!isRetryable(providerError) || attempt === MAX_SEND_ATTEMPTS - 1)
        break;
    } catch (error) {
      lastError = {
        message: error instanceof Error ? error.message : "Network error",
        name: "network_error",
      };
      if (attempt === MAX_SEND_ATTEMPTS - 1) break;
    }

    await delay(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS.at(-1) ?? 750);
  }

  throw new Error(lastError?.message || "Email delivery failed");
}

interface EventEmailDetails {
  eventId: number;
  projectName: string;
  eventTitle: string;
  eventStart: string;
  eventEnd: string;
  eventLocation: string | null;
  eventDescription: string | null;
  eventAllDay: boolean;
  eventVersionAt: string;
}

interface FormattedEvent {
  eventDate: string;
  eventTime: string;
}

function formatEvent(details: EventEmailDetails): FormattedEvent {
  const timeZone = getEmailTimeZone();
  const startDate = new Date(details.eventStart);
  const endDate = new Date(details.eventEnd);
  const eventDate = startDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  });

  if (details.eventAllDay) {
    return { eventDate, eventTime: "All day" };
  }

  const startTime = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  const endTime = endDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  });
  return { eventDate, eventTime: `${startTime} – ${endTime}` };
}

function eventAttachment(
  details: EventEmailDetails,
  cancelled = false,
): EmailAttachment {
  const ics = buildEventIcs({
    id: details.eventId,
    title: details.eventTitle,
    projectName: details.projectName,
    description: details.eventDescription,
    location: details.eventLocation,
    startAt: details.eventStart,
    endAt: details.eventEnd,
    allDay: details.eventAllDay,
    versionAt: details.eventVersionAt,
    status: cancelled ? "CANCELLED" : "CONFIRMED",
    method: cancelled ? "CANCEL" : "REQUEST",
  });
  return {
    content: Buffer.from(ics, "utf8").toString("base64"),
    filename: `sbi-event-${details.eventId}.ics`,
  };
}

async function loadProfiles(profileIds: number[]) {
  if (profileIds.length === 0) return [];
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, name, email, config")
    .in("id", profileIds);
  if (error)
    throw new Error(`Couldn't load email recipients: ${error.message}`);
  return data ?? [];
}

async function sendInSmallBatches(
  tasks: Array<() => Promise<unknown>>,
): Promise<void> {
  const failures: unknown[] = [];
  for (let index = 0; index < tasks.length; index += 2) {
    const results = await Promise.allSettled(
      tasks.slice(index, index + 2).map((task) => task()),
    );
    for (const result of results) {
      if (result.status === "rejected") failures.push(result.reason);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, `${failures.length} email(s) failed`);
  }
}

export async function sendEventInvites(
  params: EventEmailDetails & {
    organizerName: string;
    attendeeProfileIds: number[];
  },
): Promise<void> {
  const profiles = await loadProfiles(params.attendeeProfileIds);
  const { eventDate, eventTime } = formatEvent(params);
  const portalUrl = `${getPortalOrigin()}/dashboard/calendar?event=${params.eventId}`;
  const attachment = eventAttachment(params);

  await sendInSmallBatches(
    profiles.flatMap((profile) => {
      if (!profile.email || !calendarEmailEnabled(profile.config)) return [];
      const template = {
        recipientName: profile.name,
        eventTitle: params.eventTitle,
        eventDate,
        eventTime,
        eventLocation: params.eventLocation,
        eventDescription: params.eventDescription,
        organizerName: params.organizerName,
        projectName: params.projectName,
        portalUrl,
      };
      return [
        () =>
          sendEmail({
            to: profile.email as string,
            subject: `You're invited: ${params.eventTitle}`,
            html: eventInviteHtml(template),
            text: eventInviteText(template),
            attachments: [attachment],
            idempotencyKey: `event-invite/${params.eventId}/${profile.id}/${params.eventVersionAt}`,
          }),
      ];
    }),
  );
}

export async function sendEventChangeNotifications(
  params: EventEmailDetails & {
    attendeeProfileIds: number[];
    kind: EventChangeKind;
    excludeProfileId?: number;
  },
): Promise<void> {
  const recipientIds = params.attendeeProfileIds.filter(
    (id) => id !== params.excludeProfileId,
  );
  const profiles = await loadProfiles(recipientIds);
  const { eventDate, eventTime } = formatEvent(params);
  const portalUrl = `${getPortalOrigin()}/dashboard/calendar?event=${params.eventId}`;
  const attachment = eventAttachment(params, params.kind !== "updated");
  const subjectPrefix =
    params.kind === "updated"
      ? "Updated"
      : params.kind === "cancelled"
        ? "Cancelled"
        : "Invitation removed";

  await sendInSmallBatches(
    profiles.flatMap((profile) => {
      if (!profile.email || !calendarEmailEnabled(profile.config)) return [];
      const template = {
        recipientName: profile.name,
        eventTitle: params.eventTitle,
        eventDate,
        eventTime,
        eventLocation: params.eventLocation,
        projectName: params.projectName,
        portalUrl,
        kind: params.kind,
      };
      return [
        () =>
          sendEmail({
            to: profile.email as string,
            subject: `${subjectPrefix}: ${params.eventTitle}`,
            html: eventChangeHtml(template),
            text: eventChangeText(template),
            attachments: [attachment],
            idempotencyKey: `event-${params.kind}/${params.eventId}/${profile.id}/${params.eventVersionAt}`,
          }),
      ];
    }),
  );
}

export async function sendRsvpNotification(params: {
  organizerEmail: string;
  organizerName: string;
  attendeeName: string;
  attendeeProfileId: number;
  eventTitle: string;
  eventStart: string;
  response: "accepted" | "declined" | "tentative";
  projectName: string;
  eventId: number;
  responseVersionAt: string;
  organizerConfig?: unknown;
}): Promise<void> {
  if (!calendarEmailEnabled(params.organizerConfig)) return;
  const responseLabels: Record<typeof params.response, string> = {
    accepted: "accepted",
    declined: "declined",
    tentative: "tentatively accepted",
  };
  const template = {
    organizerName: params.organizerName,
    attendeeName: params.attendeeName,
    eventTitle: params.eventTitle,
    eventDate: new Date(params.eventStart).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: getEmailTimeZone(),
    }),
    response: params.response,
    projectName: params.projectName,
    portalUrl: `${getPortalOrigin()}/dashboard/calendar?event=${params.eventId}`,
  };

  await sendEmail({
    to: params.organizerEmail,
    subject: `${params.attendeeName} ${responseLabels[params.response]}: ${params.eventTitle}`,
    html: rsvpNotificationHtml(template),
    text: rsvpNotificationText(template),
    idempotencyKey: `event-rsvp/${params.eventId}/${params.attendeeProfileId}/${params.responseVersionAt}`,
  });
}

export async function sendMessageNotifications(params: {
  messageId: number;
  conversationId: number;
  senderProfileId: number;
  senderName: string;
  content: string | null;
  recipientProfileIds: number[];
}): Promise<void> {
  const recipientIds = [
    ...new Set(
      params.recipientProfileIds.filter((id) => id !== params.senderProfileId),
    ),
  ];
  const profiles = await loadProfiles(recipientIds);
  const portalUrl = `${getPortalOrigin()}/dashboard/messages/${params.conversationId}`;
  const excerpt = params.content?.trim() || "Attachment";

  await sendInSmallBatches(
    profiles.flatMap((profile) => {
      const recipientEmail = profile.email;
      if (
        !recipientEmail ||
        !emailNotificationEnabled(profile.config, "messages")
      )
        return [];
      const template = {
        recipientName: profile.name,
        senderName: params.senderName,
        excerpt,
        portalUrl,
      };
      return [
        () =>
          sendEmail({
            to: recipientEmail,
            subject: `New message from ${params.senderName}`,
            html: messageNotificationHtml(template),
            text: messageNotificationText(template),
            idempotencyKey: `message/${params.messageId}/${profile.id}`,
          }),
      ];
    }),
  );
}

export async function sendRequestUpdateNotification(params: {
  requestId: number;
  requesterUid: string;
  requestSubject: string;
  status: "pending" | "in-progress" | "done" | "denied";
  projectId: number | null;
  versionAt: string;
}): Promise<void> {
  const supabaseAdmin = createAdminClient();
  const [{ data: profile, error: profileError }, { data: project }] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, name, email, config")
        .eq("uid", params.requesterUid)
        .maybeSingle(),
      params.projectId
        ? supabaseAdmin
            .from("projects")
            .select("company_name")
            .eq("id", params.projectId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  if (profileError) {
    throw new Error(`Couldn't load request recipient: ${profileError.message}`);
  }
  if (!profile?.email || !emailNotificationEnabled(profile.config, "requests"))
    return;

  const statusLabel: Record<typeof params.status, string> = {
    pending: "Pending",
    "in-progress": "In progress",
    done: "Done",
    denied: "Denied",
  };
  const template = {
    recipientName: profile.name,
    requestSubject: params.requestSubject,
    status: statusLabel[params.status],
    projectName: project?.company_name ?? null,
    portalUrl: `${getPortalOrigin()}/dashboard/requests`,
  };

  await sendEmail({
    to: profile.email,
    subject: `Request update: ${params.requestSubject}`,
    html: requestUpdateHtml(template),
    text: requestUpdateText(template),
    idempotencyKey: `request-status/${params.requestId}/${params.versionAt}`,
  });
}

export async function sendAccountInvite(params: {
  email: string;
  recipientName: string;
  invitedByName: string;
  role: "client" | "director" | "member";
  confirmationUrl: string;
  userId: string;
}): Promise<void> {
  const roleLabels = {
    client: "a client",
    director: "a director",
    member: "a team member",
  } as const;
  const template = {
    recipientName: params.recipientName,
    invitedByName: params.invitedByName,
    roleLabel: roleLabels[params.role],
    inviteUrl: params.confirmationUrl,
  };

  await sendEmail({
    to: params.email,
    subject: "Create your SBI Portal account",
    html: accountInviteHtml(template),
    text: accountInviteText(template),
    idempotencyKey: `account-invite/${params.userId}`,
  });
}
