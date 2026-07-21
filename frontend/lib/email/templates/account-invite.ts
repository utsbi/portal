import { compactText, escapeHtml } from "./shared";

export interface AccountInviteProps {
  recipientName: string;
  invitedByName: string;
  roleLabel: string;
  inviteUrl: string;
}

export function accountInviteHtml(props: AccountInviteProps): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;background:#f5f5f5">
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
    <tr><td style="padding:32px 24px;background:#050807;border-radius:12px 12px 0 0">
      <p style="color:#22c55e;margin:0;font-size:20px;font-weight:600">SBI Portal</p>
    </td></tr>
    <tr><td style="padding:32px 24px;background:#fff;border-radius:0 0 12px 12px">
      <p style="color:#333;font-size:16px;margin:0 0 20px">Hi <strong>${escapeHtml(props.recipientName)}</strong>,</p>
      <p style="color:#333;font-size:16px;line-height:1.55;margin:0 0 24px">
        ${escapeHtml(props.invitedByName)} invited you to the SBI Portal as ${escapeHtml(props.roleLabel)}.
        Create your password to activate your account.
      </p>
      <a href="${escapeHtml(props.inviteUrl)}" style="display:inline-block;padding:12px 24px;background:#22c55e;color:#050807;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600">
        Create password
      </a>
      <p style="color:#666;font-size:13px;line-height:1.5;margin:24px 0 0">
        This is a private, one-time account link. If you were not expecting this invitation, you can ignore this email.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

export function accountInviteText(props: AccountInviteProps): string {
  return compactText([
    `Hi ${props.recipientName},`,
    "",
    `${props.invitedByName} invited you to the SBI Portal as ${props.roleLabel}.`,
    "Create your password to activate your account:",
    props.inviteUrl,
    "",
    "This is a private, one-time account link. If you were not expecting this invitation, you can ignore this email.",
  ]);
}
