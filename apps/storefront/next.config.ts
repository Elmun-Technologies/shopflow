import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Standalone output bundles a minimal runtime so the Docker image stays
  // small (~150MB) and starts fast — no full node_modules copy.
  output: "standalone",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default config;
