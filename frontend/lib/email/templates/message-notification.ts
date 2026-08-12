import { compactText, escapeHtml } from "./shared";

export interface MessageNotificationProps {
  recipientName: string;
  senderName: string;
  excerpt: string;
  portalUrl: string;
}

export function messageNotificationHtml(
  props: MessageNotificationProps,
): string {
  const excerpt =
    props.excerpt.length > 280
      ? `${props.excerpt.slice(0, 277)}...`
      : props.excerpt;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#182019">
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
    <tr><td style="padding:28px 32px;background:#050807;border-radius:12px 12px 0 0">
      <p style="margin:0;color:#22c55e;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">SBI Portal</p>
    </td></tr>
    <tr><td style="padding:32px;background:#ffffff;border-radius:0 0 12px 12px">
      <h1 style="margin:0 0 16px;color:#050807;font-size:23px;line-height:1.25">You have a new message</h1>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.55">Hi ${escapeHtml(props.recipientName)}, ${escapeHtml(props.senderName)} sent you a portal message.</p>
      <p style="margin:0 0 24px;padding:16px;border:1px solid #d9e3dc;border-radius:8px;background:#f7faf8;color:#405046;font-size:14px;line-height:1.55">${escapeHtml(excerpt)}</p>
      <a href="${escapeHtml(props.portalUrl)}" style="display:inline-block;padding:12px 20px;border-radius:6px;background:#22c55e;color:#050807;font-size:14px;font-weight:700;text-decoration:none">Open message</a>
      <p style="margin:24px 0 0;color:#68766e;font-size:12px;line-height:1.5">Manage email notifications in Portal settings.</p>
    </td></tr>
  </table>
</body></html>`;
}

export function messageNotificationText(
  props: MessageNotificationProps,
): string {
  return compactText([
    `Hi ${props.recipientName},`,
    "",
    `${props.senderName} sent you a portal message.`,
    props.excerpt,
    "",
    `Open message: ${props.portalUrl}`,
  ]);
}
