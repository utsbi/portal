interface ContentSecurityPolicyOptions {
  nonce: string;
  isDevelopment: boolean;
  supabaseUrl?: string;
}

export function buildContentSecurityPolicy({
  nonce,
  isDevelopment,
  supabaseUrl = "",
}: ContentSecurityPolicyOptions): string {
  const supabaseOrigin = supabaseUrl.replace(/\/$/, "");
  const supabaseWss = supabaseOrigin.replace(/^https?:\/\//, "wss://");
  const connectSrc = [
    "'self'",
    supabaseOrigin,
    supabaseWss,
    "https://api.assemblyai.com",
    "https://api2.assemblyai.com",
    "wss://api.assemblyai.com",
    "https://challenges.cloudflare.com",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `connect-src ${connectSrc}`,
    [
      "script-src 'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      isDevelopment ? "'unsafe-eval'" : "",
      "https://challenges.cloudflare.com",
    ]
      .filter(Boolean)
      .join(" "),
    // The UI uses React style props for runtime positioning and animation.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    `img-src 'self' data: blob: https://picsum.photos ${supabaseOrigin}`.trim(),
    `frame-src https://challenges.cloudflare.com ${supabaseOrigin}`.trim(),
    `media-src 'self' blob: ${supabaseOrigin}`.trim(),
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
