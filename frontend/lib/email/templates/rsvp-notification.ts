import { compactText, emailButton, emailDocument, escapeHtml } from "./shared";

export interface RsvpNotificationProps {
  organizerName: string;
  attendeeName: string;
  eventTitle: string;
  eventDate: string;
  response: "accepted" | "declined" | "tentative";
  projectName: string;
  portalUrl: string;
}

const responseLabels: Record<string, string> = {
  accepted: "accepted",
  declined: "declined",
  tentative: "tentatively accepted",
};

const responseColors: Record<string, string> = {
  accepted: "#22c55e",
  declined: "#ef4444",
  tentative: "#f59e0b",
};

export function rsvpNotificationHtml(props: RsvpNotificationProps): string {
  const {
    organizerName,
    attendeeName,
    eventTitle,
    eventDate,
    response,
    projectName,
    portalUrl,
  } = props;

  return emailDocument({
    brand: projectName,
    preheader: `${attendeeName} ${responseLabels[response]} your invitation`,
    content: `<p style="margin:0 0 12px;color:#22c55e;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase">Calendar</p>
      <p style="margin:0 0 20px;color:#dbe7df;font-size:16px;line-height:1.6">Hi <strong>${escapeHtml(organizerName)}</strong>,</p>
      <p style="margin:0 0 26px;color:#b8c8bd;font-size:16px;line-height:1.6"><strong style="color:#ffffff">${escapeHtml(attendeeName)}</strong> has <span style="color:${responseColors[response]};font-weight:700">${responseLabels[response]}</span> your invitation to <strong style="color:#ffffff">${escapeHtml(eventTitle)}</strong> on ${escapeHtml(eventDate)}.</p>
      ${emailButton(portalUrl, "View in Portal")}`,
  });
}

export function rsvpNotificationText(props: RsvpNotificationProps): string {
  return compactText([
    `Hi ${props.organizerName},`,
    "",
    `${props.attendeeName} has ${responseLabels[props.response]} your invitation to ${props.eventTitle} on ${props.eventDate}.`,
    "",
    `Project: ${props.projectName}`,
    `View the event in the SBI Portal: ${props.portalUrl}`,
  ]);
}
