"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { approvalPinSchema } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { Dialog } from "@merchant/ui/overlay";
import { FormField, PinInput } from "@merchant/ui/pin-input";

import { merchantApi } from "@/lib/api-client";
import { useErrorMessage } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";

export const approvalPinKey = (tenantId: string) => ["access", "approval-pin", tenantId] as const;

/**
 * Where a person sets the PIN they type on someone else's screen to approve an
 * action there. Nobody else can set or read it; it is typed twice because it
 * is never shown.
 */
export function ApprovalPinDialog({
  hasPin,
  onClose,
  tenantId,
}: Readonly<{ hasPin: boolean; onClose: () => void; tenantId: string }>) {
  const t = useTranslations("approvalPin");
  const errorMessage = useErrorMessage();
  const notify = useToast();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string>();

  const pinError = approvalPinSchema.safeParse(pin).success ? undefined : t("pinRequired");
  const againError = again === pin ? undefined : t("pinMismatch");

  const save = useMutation({
    mutationFn: () => merchantApi.setApprovalPin(tenantId, { pin }),
    // Shown at the field: the person fixes it right there.
    onError: (error) => setServerError(errorMessage(error)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: approvalPinKey(tenantId) });
      notify({ message: t("saved"), tone: "success" });
      onClose();
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!pinError && !againError) save.mutate();
  }

  return (
    <Dialog
      closeLabel={t("close")}
      description={t("description")}
      footer={
        <Button
          form="approval-pin-form"
          loading={save.isPending}
          loadingLabel={t("saving")}
          type="submit"
        >
          {t("save")}
        </Button>
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={hasPin ? t("titleChange") : t("titleSet")}
    >
      <form className="grid gap-5" id="approval-pin-form" noValidate onSubmit={submit}>
        <FormField
          {...(serverError
            ? { error: serverError }
            : submitted && pinError
              ? { error: pinError }
              : {})}
          htmlFor="approval-pin-new"
          label={t("newPin")}
        >
          <PinInput
            autoFocus
            disabled={save.isPending}
            id="approval-pin-new"
            onValueChange={(value) => {
              setPin(value);
              setServerError(undefined);
            }}
            value={pin}
          />
        </FormField>
        <FormField
          {...(submitted && !pinError && againError ? { error: againError } : {})}
          htmlFor="approval-pin-again"
          label={t("repeatPin")}
        >
          <PinInput
            disabled={save.isPending}
            id="approval-pin-again"
            onValueChange={setAgain}
            value={again}
          />
        </FormField>
      </form>
    </Dialog>
  );
}
