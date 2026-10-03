import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { loadMessages, resolveLocale } from "@/i18n/server";
import { IntlProvider } from "@/providers/intl-provider";
import { QueryProvider } from "@/providers/query-provider";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Cafe Companion",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cafe Companion",
  },
  description: "Merchant backoffice untuk operasi tenant dan outlet",
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { type: "image/svg+xml", url: "/icon.svg" },
      { sizes: "32x32", type: "image/png", url: "/icon-32.png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  title: "Cafe Companion",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { color: "rgb(249 250 251)", media: "(prefers-color-scheme: light)" }, // color-guardrails-ignore-line: PWA viewport requires concrete CSS color.
    { color: "rgb(9 10 12)", media: "(prefers-color-scheme: dark)" }, // color-guardrails-ignore-line: PWA viewport requires concrete CSS color.
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await resolveLocale();
  const messages = await loadMessages(locale);

  return (
    <html
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      lang={locale}
      suppressHydrationWarning
    >
      <body>
        <IntlProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <QueryProvider>{children}</QueryProvider>
          </ThemeProvider>
        </IntlProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
