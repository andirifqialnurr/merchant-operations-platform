"use client";

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";

import { Brand } from "@merchant/ui/brand";
import { SegmentedControl } from "@merchant/ui/selection-control";

import { LoginForm } from "@/features/auth";
import { localeOptions, useLocaleSwitch } from "@/i18n/use-locale-switch";

/** Only same-origin paths are accepted so the redirect cannot leave the app. */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/catalog";
}

function Login() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  return <LoginForm onSignedIn={() => router.replace(next)} />;
}

export default function LoginPage() {
  const t = useTranslations("shell");
  const { locale, setLocale } = useLocaleSwitch();

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-4">
      <div className="grid w-full max-w-sm justify-items-center gap-4">
        <Brand name={t("brand")} size="lg" />
        <div className="w-full rounded-lg border border-line-default bg-surface p-6">
          <Suspense>
            <Login />
          </Suspense>
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
