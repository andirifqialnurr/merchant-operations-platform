"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Brand } from "@merchant/ui/brand";
import { SegmentedControl } from "@merchant/ui/selection-control";

import { InviteForm } from "@/features/auth";
import { localeOptions, useLocaleSwitch } from "@/i18n/use-locale-switch";

export default function InvitePage() {
  const t = useTranslations("shell");
  const router = useRouter();
  const { locale, setLocale } = useLocaleSwitch();

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-4">
      <div className="grid w-full max-w-sm justify-items-center gap-4">
        <Brand name={t("brand")} size="lg" />
        <div className="w-full rounded-lg border border-line-default bg-surface p-6">
          <InviteForm
            onJoined={(path) => router.replace(path)}
            onSignIn={() => router.replace("/login")}
          />
        </div>
        <SegmentedControl
          items={localeOptions}
          label={t("language")}
          onValueChange={setLocale}
          size="sm"
          value={locale}
        />
      </div>
    </main>
  );
}
