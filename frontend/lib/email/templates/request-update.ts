import {
  compactText,
  emailButton,
  emailDocument,
  emailPanel,
  escapeHtml,
} from "./shared";

export interface RequestUpdateProps {
  recipientName: string;
  requestSubject: string;
  status: string;
  projectName: string | null;
  portalUrl: string;
}

export function requestUpdateHtml(props: RequestUpdateProps): string {
  return emailDocument({
    preheader: `Request update: ${props.requestSubject}`,
    content: `<p style="margin:0 0 12px;color:#22c55e;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase">Requests</p>
      <h1 style="margin:0 0 18px;color:#ffffff;font-size:25px;line-height:1.2;font-weight:500;letter-spacing:-.02em">Your request was updated</h1>
      <p style="margin:0 0 22px;color:#dbe7df;font-size:16px;line-height:1.6">Hi ${escapeHtml(props.recipientName)}, the status of your request has changed.</p>
      ${emailPanel(`<p style="margin:0 0 6px;color:#7d8f86;font-size:11px;text-transform:uppercase;letter-spacing:.12em">Request</p><p style="margin:0 0 16px;color:#ffffff;font-size:16px;font-weight:600">${escapeHtml(props.requestSubject)}</p><p style="margin:0 0 6px;color:#7d8f86;font-size:11px;text-transform:uppercase;letter-spacing:.12em">New status</p><p style="margin:0;color:#22c55e;font-size:16px;font-weight:600">${escapeHtml(props.status)}</p>${props.projectName ? `<p style="margin:14px 0 0;color:#7d8f86;font-size:13px">${escapeHtml(props.projectName)}</p>` : ""}`)}
      ${emailButton(props.portalUrl, "View request")}`,
  });
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
