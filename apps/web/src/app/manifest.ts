import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "rgb(248 250 252)", // color-guardrails-ignore-line: PWA manifest requires concrete CSS color.
    categories: ["business", "productivity"],
    description: "Merchant Operations PWA untuk POS, KDS, Inventory, dan Backoffice.",
    dir: "ltr",
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "any",
        src: "/merchant-pwa-icon.svg",
        type: "image/svg+xml",
      },
      {
        purpose: "maskable",
        sizes: "any",
        src: "/merchant-pwa-icon.svg",
        type: "image/svg+xml",
      },
    ],
    id: "/",
    lang: "id",
    name: "Merchant Operations Platform",
    orientation: "any",
    scope: "/",
    short_name: "Merchant Ops",
    start_url: "/",
    theme_color: "rgb(15 118 110)", // color-guardrails-ignore-line: PWA manifest requires concrete CSS color.
  };
}
