import type { NextConfig } from "next";

/**
 * Routes named `page.dev.tsx` (design references, the old device mode home, and
 * the KDS/Inventory placeholders) exist only while developing; a production
 * build does not see them.
 */
const pageExtensions =
  process.env.NODE_ENV === "production" ? ["tsx", "ts"] : ["dev.tsx", "tsx", "ts"];

const nextConfig: NextConfig = {
  pageExtensions,
  reactStrictMode: true,
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:3001";
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
