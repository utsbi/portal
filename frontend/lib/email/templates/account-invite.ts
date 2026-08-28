import { compactText, emailButton, emailDocument, escapeHtml } from "./shared";

export interface AccountInviteProps {
  recipientName: string;
  invitedByName: string;
  roleLabel: string;
  inviteUrl: string;
}

export function accountInviteHtml(props: AccountInviteProps): string {
  return emailDocument({
    preheader: "Your SBI Portal account is ready to set up",
    content: `<p style="margin:0 0 12px;color:#22c55e;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase">Account access</p>
      <h1 style="margin:0 0 18px;color:#ffffff;font-size:25px;line-height:1.2;font-weight:500;letter-spacing:-.02em">Create your portal password</h1>
      <p style="margin:0 0 22px;color:#dbe7df;font-size:16px;line-height:1.6">Hi <strong>${escapeHtml(props.recipientName)}</strong>,</p>
      <p style="margin:0 0 26px;color:#b8c8bd;font-size:16px;line-height:1.6">${escapeHtml(props.invitedByName)} invited you to the SBI Portal as ${escapeHtml(props.roleLabel)}. Create a password to activate your account.</p>
      ${emailButton(props.inviteUrl, "Create password")}
      <p style="margin:24px 0 0;color:#7d8f86;font-size:13px;line-height:1.55">This private, one-time link is intended only for you. If you were not expecting this invitation, you can ignore it.</p>`,
  });
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
