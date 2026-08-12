import { compactText, escapeHtml } from "./shared";

export interface RequestUpdateProps {
  recipientName: string;
  requestSubject: string;
  status: string;
  projectName: string | null;
  portalUrl: string;
}

export function requestUpdateHtml(props: RequestUpdateProps): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#182019">
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
    <tr><td style="padding:28px 32px;background:#050807;border-radius:12px 12px 0 0"><p style="margin:0;color:#22c55e;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">SBI Portal</p></td></tr>
    <tr><td style="padding:32px;background:#ffffff;border-radius:0 0 12px 12px">
      <h1 style="margin:0 0 16px;color:#050807;font-size:23px;line-height:1.25">Your request was updated</h1>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.55">Hi ${escapeHtml(props.recipientName)}, the status of your request has changed.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;border:1px solid #d9e3dc;border-radius:8px;background:#f7faf8"><tr><td style="padding:16px"><p style="margin:0 0 5px;color:#68766e;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Request</p><p style="margin:0 0 14px;color:#182019;font-size:16px;font-weight:700">${escapeHtml(props.requestSubject)}</p><p style="margin:0 0 5px;color:#68766e;font-size:12px;text-transform:uppercase;letter-spacing:.08em">New status</p><p style="margin:0;color:#146c36;font-size:16px;font-weight:700">${escapeHtml(props.status)}</p>${props.projectName ? `<p style="margin:14px 0 0;color:#68766e;font-size:13px">${escapeHtml(props.projectName)}</p>` : ""}</td></tr></table>
      <a href="${escapeHtml(props.portalUrl)}" style="display:inline-block;padding:12px 20px;border-radius:6px;background:#22c55e;color:#050807;font-size:14px;font-weight:700;text-decoration:none">View request</a>
    </td></tr>
  </table>
</body></html>`;
}

export function requestUpdateText(props: RequestUpdateProps): string {
  return compactText([
    `Hi ${props.recipientName},`,
    "",
    "Your request was updated.",
    `Request: ${props.requestSubject}`,
    `Status: ${props.status}`,
    props.projectName ? `Project: ${props.projectName}` : null,
    "",
    `View request: ${props.portalUrl}`,
  ]);
}
