import { compactText, escapeHtml } from "./shared";

export interface EventInviteProps {
  recipientName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation: string | null;
  eventDescription: string | null;
  organizerName: string;
  projectName: string;
  portalUrl: string;
}

export function eventInviteHtml(props: EventInviteProps): string {
  const {
    recipientName,
    eventTitle,
    eventDate,
    eventTime,
    eventLocation,
    eventDescription,
    organizerName,
    projectName,
    portalUrl,
  } = props;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;background:#f5f5f5">
  <table align="center" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
    <tr><td style="padding:32px 24px;background:#050807;border-radius:12px 12px 0 0">
      <h1 style="color:#22c55e;margin:0;font-size:20px">${escapeHtml(projectName)}</h1>
    </td></tr>
    <tr><td style="padding:32px 24px;background:#fff;border-radius:0 0 12px 12px">
      <p style="color:#333;font-size:16px;margin:0 0 24px">
        Hi <strong>${escapeHtml(recipientName)}</strong>,
      </p>
      <p style="color:#333;font-size:16px;margin:0 0 24px">
        ${escapeHtml(organizerName)} has invited you to an event:
      </p>
      <div style="border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin-bottom:24px">
        <h2 style="margin:0 0 12px;font-size:18px;color:#050807">${escapeHtml(eventTitle)}</h2>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">Date</td>
              <td style="padding:4px 0;color:#333">${escapeHtml(eventDate)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">Time</td>
              <td style="padding:4px 0;color:#333">${escapeHtml(eventTime)}</td></tr>
          ${
            eventLocation
              ? `<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">Location</td>
              <td style="padding:4px 0;color:#333">${escapeHtml(eventLocation)}</td></tr>`
              : ""
          }
          <tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">Organizer</td>
              <td style="padding:4px 0;color:#333">${escapeHtml(organizerName)}</td></tr>
        </table>
        ${eventDescription ? `<p style="margin:16px 0 0;color:#555;font-size:14px">${escapeHtml(eventDescription)}</p>` : ""}
      </div>
      <a href="${escapeHtml(portalUrl)}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#fff;text-decoration:none;border-radius:6px;font-size:15px">
        View in Portal
      </a>
      <p style="color:#888;font-size:13px;margin-top:24px">
        You can RSVP directly in the portal.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

export function eventInviteText(props: EventInviteProps): string {
  return compactText([
    `Hi ${props.recipientName},`,
    "",
    `${props.organizerName} has invited you to an event for ${props.projectName}.`,
    "",
    props.eventTitle,
    `Date: ${props.eventDate}`,
    `Time: ${props.eventTime}`,
    props.eventLocation ? `Location: ${props.eventLocation}` : null,
    props.eventDescription ? `Details: ${props.eventDescription}` : null,
    "",
    `View and RSVP in the SBI Portal: ${props.portalUrl}`,
  ]);
}
