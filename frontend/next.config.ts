import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
    ],
  },
  reactStrictMode: true,

  // Suppress hydration warnings caused by browser extensions
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Optimize package imports
  experimental: {
    optimizePackageImports: ["lucide-react", "gsap", "@mantine/core"],
  },
};

export default nextConfig;
