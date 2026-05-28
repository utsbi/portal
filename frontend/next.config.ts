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
    qualities: [70, 75],
  },
  reactStrictMode: true,

  // Suppress hydration warnings caused by browser extensions
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Keep server-only SDKs out of the bundler's reachability analysis.
  serverExternalPackages: ["googleapis"],

  // Optimize package imports
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "gsap",
      "@phosphor-icons/react",
      "@react-three/drei",
      "recharts",
      "react-syntax-highlighter",
      "motion",
    ],
  },
};

export default nextConfig;
