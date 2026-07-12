interface RsvpNotificationProps {
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
        Hi <strong>${escapeHtml(organizerName)}</strong>,
      </p>
      <p style="color:#333;font-size:16px;margin:0 0 24px">
        <strong>${escapeHtml(attendeeName)}</strong> has
        <span style="color:${responseColors[response]};font-weight:600">${responseLabels[response]}</span>
        your invitation to <strong>${escapeHtml(eventTitle)}</strong>
        on ${escapeHtml(eventDate)}.
      </p>
      <a href="${escapeHtml(portalUrl)}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#fff;text-decoration:none;border-radius:6px;font-size:15px">
        View in Portal
      </a>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
