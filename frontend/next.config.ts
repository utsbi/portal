import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Derive the realtime wss origin from the Supabase project URL
// e.g. https://abc.supabase.co → wss://abc.supabase.co
const supabaseWss = supabaseUrl.replace(/^https?:\/\//, "wss://");
const supabaseOrigin = supabaseUrl.replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle for the Docker runtime
  // (consumed by frontend/Dockerfile). No-op for `next dev`.
  output: "standalone",

  // Cross-origin hosts allowed to hit the dev server (Tailscale, LAN phones,
  // etc.). No-op in production. Add the dev machine's LAN IP here so a phone
  // on the same network can reach the server.
  allowedDevOrigins: [
    "galileo",
    "galileo.bear-ling.ts.net",
    "100.68.183.80",
    "192.168.0.145",
  ],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
    ],
    // Allowed <Image quality> values. Next 16 defaults to [75]; some images
    // (e.g. the login hero) request 70, so both must be declared.
    qualities: [70, 75],
  },
  reactStrictMode: true,

  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "gsap",
      "@react-three/drei",
      "recharts",
      "motion",
    ],
  },

  async headers() {
    // Build connect-src dynamically so it picks up the runtime Supabase URL.
    // In CI / build time the env may be empty; the fallback keeps build clean
    // and the real value is present at runtime via Docker env injection.
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

    const csp = [
      "default-src 'self'",
      `connect-src ${connectSrc}`,
      // Next.js injects inline scripts; nonces require per-request headers
      // which don't work with static export — use unsafe-inline for now.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      `img-src 'self' data: blob: https://picsum.photos ${supabaseOrigin}`,
      // The Files page previews PDFs in an <iframe> and video/audio via
      // <video>/<audio>, all pointing at Supabase Storage signed URLs — the
      // storage origin must be allowed or the browser renders "This content
      // is blocked" in place of the preview.
      `frame-src https://challenges.cloudflare.com ${supabaseOrigin}`.trim(),
      `media-src 'self' blob: ${supabaseOrigin}`.trim(),
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
