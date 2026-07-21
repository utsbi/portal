import { compactText, escapeHtml } from "./shared";

export type EventChangeKind = "updated" | "cancelled" | "removed";

export interface EventChangeProps {
  recipientName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string | null;
  projectName: string;
  portalUrl: string;
  kind: EventChangeKind;
}

const copy: Record<EventChangeKind, { heading: string; sentence: string }> = {
  updated: {
    heading: "Event updated",
    sentence: "The event details have changed.",
  },
  cancelled: {
    heading: "Event cancelled",
    sentence: "This event has been cancelled.",
  },
  removed: {
    heading: "Invitation removed",
    sentence: "You are no longer listed as an attendee for this event.",
  },
};

export function eventChangeHtml(props: EventChangeProps): string {
  const message = copy[props.kind];
  const showPortalLink = props.kind !== "cancelled";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;background:#f5f5f5">
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
    <tr><td style="padding:32px 24px;background:#050807;border-radius:12px 12px 0 0">
      <p style="color:#22c55e;margin:0;font-size:20px;font-weight:600">${escapeHtml(props.projectName)}</p>
    </td></tr>
    <tr><td style="padding:32px 24px;background:#fff;border-radius:0 0 12px 12px">
      <p style="color:#333;font-size:16px;margin:0 0 20px">Hi <strong>${escapeHtml(props.recipientName)}</strong>,</p>
      <h1 style="color:#050807;font-size:20px;margin:0 0 8px">${message.heading}</h1>
      <p style="color:#555;font-size:15px;line-height:1.55;margin:0 0 20px">${message.sentence}</p>
      <div style="border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin-bottom:24px">
        <h2 style="margin:0 0 12px;font-size:18px;color:#050807">${escapeHtml(props.eventTitle)}</h2>
        <p style="margin:4px 0;color:#333"><strong>Date:</strong> ${escapeHtml(props.eventDate)}</p>
        <p style="margin:4px 0;color:#333"><strong>Time:</strong> ${escapeHtml(props.eventTime)}</p>
        ${props.eventLocation ? `<p style="margin:4px 0;color:#333"><strong>Location:</strong> ${escapeHtml(props.eventLocation)}</p>` : ""}
      </div>
      ${showPortalLink ? `<a href="${escapeHtml(props.portalUrl)}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#050807;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600">View in Portal</a>` : ""}
    </td></tr>
  </table>
</body></html>`;
}

export function eventChangeText(props: EventChangeProps): string {
  const message = copy[props.kind];
  return compactText([
    `Hi ${props.recipientName},`,
    "",
    message.heading,
    message.sentence,
    "",
    props.eventTitle,
    `Date: ${props.eventDate}`,
    `Time: ${props.eventTime}`,
    props.eventLocation ? `Location: ${props.eventLocation}` : null,
    props.kind !== "cancelled"
      ? `View in the SBI Portal: ${props.portalUrl}`
      : null,
  ]);
}
