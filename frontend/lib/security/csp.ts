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
    // three.js ImageBitmapLoader fetches blob: URLs for GLB-embedded textures
    // (all project models embed their textures).
    "blob:",
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
      // The 3D project viewer's Draco decoder instantiates WebAssembly
      // inside a Web Worker (which inherits this policy). Without
      // 'wasm-unsafe-eval' the decode never resolves and the loading
      // screen hangs. Decoder files are self-hosted under /draco/.
      "'wasm-unsafe-eval'",
      isDevelopment ? "'unsafe-eval'" : "",
      "https://challenges.cloudflare.com",
    ]
      .filter(Boolean)
      .join(" "),
    // DRACOLoader builds its decoder worker from a blob: URL.
    "worker-src 'self' blob:",
    // The UI uses React style props for runtime positioning and animation.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // img.youtube.com hosts the lite-embed thumbnails in ProjectDetails.
    `img-src 'self' data: blob: https://picsum.photos https://img.youtube.com ${supabaseOrigin}`.trim(),
    // youtube-nocookie serves the privacy-enhanced video embed iframe.
    `frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com ${supabaseOrigin}`.trim(),
    `media-src 'self' blob: ${supabaseOrigin}`.trim(),
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
