import {
  compactText,
  emailButton,
  emailDocument,
  emailPanel,
  escapeHtml,
} from "./shared";

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
  return emailDocument({
    preheader: `New message from ${props.senderName}`,
    content: `<p style="margin:0 0 12px;color:#22c55e;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase">Messages</p>
      <h1 style="margin:0 0 18px;color:#ffffff;font-size:25px;line-height:1.2;font-weight:500;letter-spacing:-.02em">You have a new message</h1>
      <p style="margin:0 0 22px;color:#dbe7df;font-size:16px;line-height:1.6">Hi ${escapeHtml(props.recipientName)}, ${escapeHtml(props.senderName)} sent you a portal message.</p>
      ${emailPanel(`<p style="margin:0;color:#b8c8bd;font-size:14px;line-height:1.6">${escapeHtml(excerpt)}</p>`)}
      ${emailButton(props.portalUrl, "Open message")}<p style="margin:22px 0 0;color:#7d8f86;font-size:13px">Manage email notifications in Portal settings.</p>`,
  });
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
