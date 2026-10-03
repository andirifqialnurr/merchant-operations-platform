"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

import { useLocaleSwitch } from "@/i18n/use-locale-switch";

import type { ShellUser } from "./shell-controls";

/**
 * Applies the language and theme saved on the user's profile, so a choice
 * made on one device follows the user to the next. Runs once per user; after
 * that the account menu changes both the screen and the profile.
 */
export function PreferenceSync({ user }: Readonly<{ user: ShellUser & { id: string } }>) {
  const { setTheme, theme } = useTheme();
  const { locale, setLocale } = useLocaleSwitch();
  const appliedFor = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (appliedFor.current === user.id) return;
    appliedFor.current = user.id;
    if (user.theme && user.theme !== theme) setTheme(user.theme);
    if (user.locale && user.locale !== locale) setLocale(user.locale);
  }, [locale, setLocale, setTheme, theme, user]);

  return null;
}
