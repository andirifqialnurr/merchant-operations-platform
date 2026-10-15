"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ToastProvider } from "@/providers/toast-provider";

/** Guests have no merchant session; the theme follows their device. */
export default function CustomerLayout({ children }: Readonly<{ children: ReactNode }>) {
  const t = useTranslations("shell");
  return (
    <ToastProvider dismissLabel={t("dismissToast")} placement="top-center">
      <div className="min-h-dvh bg-canvas text-foreground">{children}</div>
    </ToastProvider>
  );
}
