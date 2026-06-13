import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle for the Docker runtime
  // (consumed by frontend/Dockerfile). No-op for `next dev`.
  output: "standalone",

  // Cross-origin hosts allowed to hit the dev server (Tailscale, etc.).
  // No-op in production.
  allowedDevOrigins: [
    "galileo",
    "galileo.bear-ling.ts.net",
    "100.68.183.80",
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

  // Keep server-only SDKs out of the bundler's reachability analysis.
  serverExternalPackages: ["googleapis"],

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "gsap",
      "@phosphor-icons/react",
      "@react-three/drei",
      "recharts",
      "motion",
    ],
  },
};

export default nextConfig;
