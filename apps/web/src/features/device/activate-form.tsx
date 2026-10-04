"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import { activateDeviceSchema } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { Alert, Skeleton } from "@merchant/ui/feedback";
import { FormField, Input } from "@merchant/ui/form-field";

import { useErrorMessage } from "@/lib/i18n";

import { useActivateDevice, useCurrentDevice } from "./api";

/**
 * What a cashier tablet shows before anyone signs in: a field for the
 * one-time code, and once the device is active, which device it is and the
 * way into the cashier screen.
 */
export function ActivateForm({ onOpenPos }: Readonly<{ onOpenPos: () => void }>) {
  const t = useTranslations("activate");
  const errorMessage = useErrorMessage();
  const current = useCurrentDevice();
  const activate = useActivateDevice();
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = activateDeviceSchema.safeParse({ code });
    setInvalid(!parsed.success);
    if (parsed.success) activate.mutate(parsed.data.code);
  }

  if (current.isPending) return <Skeleton variant="metric-card" />;

  const device = current.data;
  if (device) {
    return (
      <div className="grid gap-4">
        <h1 className="text-heading-lg">{t("activeTitle")}</h1>
        <p className="m-0 text-label text-foreground-secondary">
          {t("activeDescription", { label: device.label, mode: t(`modeName.${device.mode}`) })}
        </p>
        {device.mode === "POS" ? (
          <Button fullWidth onClick={onOpenPos} size="lg">
            {t("openPos")}
          </Button>
        ) : (
          <p className="m-0 text-label text-foreground-secondary">{t("kdsNotReady")}</p>
        )}
      </div>
    );
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={submit}>
      <h1 className="text-heading-lg">{t("title")}</h1>
      {activate.error ? (
        <Alert title={t("failed")} tone="danger">
          {errorMessage(activate.error)}
        </Alert>
      ) : null}
      <FormField
        {...(invalid ? { error: t("codeInvalid") } : {})}
        helperText={t("codeHint")}
        htmlFor="activation-code"
        label={t("code")}
      >
        <Input
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          id="activation-code"
          maxLength={9}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          size="lg"
          spellCheck={false}
          value={code}
        />
      </FormField>
      <Button
        fullWidth
        loading={activate.isPending}
        loadingLabel={t("activating")}
        size="lg"
        type="submit"
      >
        {t("activate")}
      </Button>
    </form>
  );
}
