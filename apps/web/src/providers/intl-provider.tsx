"use client";

import type { ComponentProps, ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";

import type { Locale } from "@/i18n/locale";

type Messages = NonNullable<ComponentProps<typeof NextIntlClientProvider>["messages"]>;

/**
 * Client-side provider fed by the root layout. The language and dictionary are
 * resolved there, so no next-intl build plugin or server config file is needed.
 */
export function IntlProvider({
  children,
  locale,
  messages,
}: Readonly<{ children: ReactNode; locale: Locale; messages: Messages }>) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Jakarta">
      {children}
    </NextIntlClientProvider>
  );
}
