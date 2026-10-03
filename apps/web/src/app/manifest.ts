import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "rgb(249 250 251)", // color-guardrails-ignore-line: PWA manifest requires concrete CSS color.
    categories: ["business", "productivity"],
    description: "Merchant Operations PWA untuk POS, KDS, Inventory, dan Backoffice.",
    dir: "ltr",
    display: "standalone",
    icons: [
      { purpose: "any", sizes: "any", src: "/icon.svg", type: "image/svg+xml" },
      { purpose: "any", sizes: "192x192", src: "/icon-192.png", type: "image/png" },
      { purpose: "any", sizes: "512x512", src: "/icon-512.png", type: "image/png" },
      { purpose: "maskable", sizes: "512x512", src: "/icon-maskable-512.png", type: "image/png" },
    ],
    id: "/",
    lang: "id",
    name: "Cafe Companion",
    orientation: "any",
    scope: "/",
    short_name: "Cafe Companion",
    start_url: "/",
    theme_color: "rgb(22 24 28)", // color-guardrails-ignore-line: PWA manifest requires concrete CSS color.
  };
}
