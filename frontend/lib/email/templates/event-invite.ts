import {
  compactText,
  emailButton,
  emailDocument,
  emailPanel,
  escapeHtml,
} from "./shared";

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

  return emailDocument({
    brand: projectName,
    preheader: `Event invitation: ${eventTitle}`,
    content: `<p style="margin:0 0 12px;color:#22c55e;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase">Calendar</p>
      <p style="margin:0 0 18px;color:#dbe7df;font-size:16px;line-height:1.6">Hi <strong>${escapeHtml(recipientName)}</strong>,</p>
      <p style="margin:0 0 22px;color:#b8c8bd;font-size:16px;line-height:1.6">${escapeHtml(organizerName)} invited you to an event.</p>
      ${emailPanel(`<h2 style="margin:0 0 14px;color:#ffffff;font-size:18px;font-weight:500">${escapeHtml(eventTitle)}</h2><p style="margin:5px 0;color:#b8c8bd;font-size:14px"><strong style="color:#7d8f86">Date:</strong> ${escapeHtml(eventDate)}</p><p style="margin:5px 0;color:#b8c8bd;font-size:14px"><strong style="color:#7d8f86">Time:</strong> ${escapeHtml(eventTime)}</p>${eventLocation ? `<p style="margin:5px 0;color:#b8c8bd;font-size:14px"><strong style="color:#7d8f86">Location:</strong> ${escapeHtml(eventLocation)}</p>` : ""}<p style="margin:5px 0;color:#b8c8bd;font-size:14px"><strong style="color:#7d8f86">Organizer:</strong> ${escapeHtml(organizerName)}</p>${eventDescription ? `<p style="margin:16px 0 0;color:#b8c8bd;font-size:14px;line-height:1.55">${escapeHtml(eventDescription)}</p>` : ""}`)}
      ${emailButton(portalUrl, "View in Portal")}<p style="margin:22px 0 0;color:#7d8f86;font-size:13px">You can RSVP directly in the portal.</p>`,
  });
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
