import type { NextConfig } from "next";

const docsAppUrl = process.env.DOCS_APP_URL || "https://docs.utsbi.org";
const allowedDevOrigins = (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/docs",
        destination: `${docsAppUrl}/docs`,
      },
      {
        source: "/docs/:path*",
        destination: `${docsAppUrl}/docs/:path*`,
      },
    ];
  },

  // Produce a self-contained server bundle for the Docker runtime
  // (consumed by frontend/Dockerfile). No-op for `next dev`.
  output: "standalone",

  // Optional development-only LAN/Tailscale hosts, kept out of source control.
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
    ],
    // Allowed <Image quality> values. Next 16 defaults to [75]; some images
    // (e.g. the login hero) request 70 or 100, so all must be declared.
    qualities: [70, 75, 100],
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
        ],
      },
    ];
  },
};

export default nextConfig;
