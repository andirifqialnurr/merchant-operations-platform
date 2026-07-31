import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { ThemeProvider } from "@/components/theme/theme-provider";

import "./globals.css";
import "./backoffice-shell.css";
import "./catalog.css";

export const metadata: Metadata = {
  applicationName: "Merchant Operations Platform",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Merchant Ops",
  },
  description: "Merchant backoffice untuk operasi tenant dan outlet",
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/merchant-pwa-icon.svg",
    icon: "/merchant-pwa-icon.svg",
  },
  manifest: "/manifest.webmanifest",
  title: "Merchant Operations Platform",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { color: "rgb(248 250 252)", media: "(prefers-color-scheme: light)" }, // color-guardrails-ignore-line: PWA viewport requires concrete CSS color.
    { color: "rgb(15 23 42)", media: "(prefers-color-scheme: dark)" }, // color-guardrails-ignore-line: PWA viewport requires concrete CSS color.
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      lang="id"
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
