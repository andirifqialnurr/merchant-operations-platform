import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { ThemeProvider } from "@/components/theme/theme-provider";

import "./globals.css";
import "./catalog.css";

export const metadata: Metadata = {
  title: "Merchant Operations Platform",
  description: "Merchant backoffice untuk operasi tenant dan outlet",
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
      </body>
    </html>
  );
}
