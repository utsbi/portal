import {
  compactText,
  emailButton,
  emailDocument,
  emailPanel,
  escapeHtml,
} from "./shared";

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

  return emailDocument({
    brand: props.projectName,
    preheader: `${message.heading}: ${props.eventTitle}`,
    content: `<p style="margin:0 0 12px;color:#22c55e;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase">Calendar</p>
      <p style="margin:0 0 18px;color:#dbe7df;font-size:16px;line-height:1.6">Hi <strong>${escapeHtml(props.recipientName)}</strong>,</p>
      <h1 style="margin:0 0 8px;color:#ffffff;font-size:25px;line-height:1.2;font-weight:500;letter-spacing:-.02em">${message.heading}</h1>
      <p style="margin:0 0 22px;color:#b8c8bd;font-size:15px;line-height:1.6">${message.sentence}</p>
      ${emailPanel(`<h2 style="margin:0 0 14px;color:#ffffff;font-size:18px;font-weight:500">${escapeHtml(props.eventTitle)}</h2><p style="margin:5px 0;color:#b8c8bd;font-size:14px"><strong style="color:#7d8f86">Date:</strong> ${escapeHtml(props.eventDate)}</p><p style="margin:5px 0;color:#b8c8bd;font-size:14px"><strong style="color:#7d8f86">Time:</strong> ${escapeHtml(props.eventTime)}</p>${props.eventLocation ? `<p style="margin:5px 0;color:#b8c8bd;font-size:14px"><strong style="color:#7d8f86">Location:</strong> ${escapeHtml(props.eventLocation)}</p>` : ""}`)}
      ${showPortalLink ? emailButton(props.portalUrl, "View in Portal") : ""}`,
  });
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
