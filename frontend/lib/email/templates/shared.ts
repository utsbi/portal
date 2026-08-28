export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function compactText(lines: Array<string | null | undefined>): string {
  return lines.filter((line): line is string => Boolean(line)).join("\n");
}

const SYSTEM_FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO_FONT = "'SFMono-Regular',Consolas,'Liberation Mono',monospace";

export function emailButton(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 22px;background:#0f1a12;border:1px solid #22c55e;color:#22c55e;text-decoration:none;border-radius:4px;font-family:${SYSTEM_FONT};font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(label)} <span aria-hidden="true" style="font-size:16px;line-height:0">→</span></a>`;
}

export function emailPanel(content: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;border:1px solid #16301d;background:#0f1a12"><tr><td style="padding:18px">${content}</td></tr></table>`;
}

export function emailDocument({
  preheader,
  brand = "SBI Portal",
  content,
  footer = "Sustainable Building Initiative · SBI Portal",
}: {
  preheader: string;
  brand?: string;
  content: string;
  footer?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(preheader)}</title>
  <style>
    body{margin:0!important;padding:0!important;background:#050807;color:#dbe7df;font-family:${SYSTEM_FONT};-webkit-font-smoothing:antialiased}
    table{border-spacing:0}
    .email-wrap{width:100%;padding:26px 14px}
    .email-card{max-width:600px;width:100%;margin:0 auto;background:#0a120c;border:1px solid #16301d}
    .email-content{padding:40px 38px}
    .email-footer{padding:20px 38px 28px;border-top:1px solid #16301d;color:#7d8f86;font-size:12px;line-height:1.6}
    @media screen and (max-width:620px){.email-wrap{padding:12px 8px}.email-content{padding:30px 22px}.email-footer{padding:18px 22px 24px}}
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-wrap" bgcolor="#050807">
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" class="email-card">
        <tr><td style="padding:22px 38px;border-bottom:1px solid #16301d">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width:7px;height:7px;background:#22c55e;font-size:0;line-height:0">&nbsp;</td><td style="padding-left:10px;color:#22c55e;font-family:${SYSTEM_FONT};font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase">SBI <span style="color:#7d8f86">/</span> ${escapeHtml(brand)}</td></tr></table>
        </td></tr>
        <tr><td class="email-content">${content}</td></tr>
        <tr><td class="email-footer">${escapeHtml(footer)}<br><span style="font-family:${MONO_FONT};font-size:10px;letter-spacing:.08em">UTSBI.ORG</span></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
