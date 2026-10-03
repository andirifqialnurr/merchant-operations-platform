import { readFileSync } from "node:fs";

import type { NextConfig } from "next";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

/**
 * Routes named `page.dev.tsx` (design references, the old device mode home, and
 * the KDS/Inventory placeholders) exist only while developing; a production
 * build does not see them.
 */
const pageExtensions =
  process.env.NODE_ENV === "production" ? ["tsx", "ts"] : ["dev.tsx", "tsx", "ts"];

const nextConfig: NextConfig = {
  // Sent with every API request as the client version; a release sets it explicitly.
  env: { NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? version },
  pageExtensions,
  reactStrictMode: true,
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:3001";
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
