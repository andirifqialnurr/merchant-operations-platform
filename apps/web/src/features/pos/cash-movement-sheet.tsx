"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";

import type { CashMovementDirection, RecordCashMovement } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { MoneyInput } from "@merchant/ui/money-input";
import { SegmentedControl } from "@merchant/ui/selection-control";
import { Sheet } from "@merchant/ui/sheet";
import { FormField, Textarea } from "@merchant/ui/textarea";

import { useFormat } from "@/lib/i18n";

const NOTE_MIN_LENGTH = 3;

/**
 * Records cash put into or taken out of the drawer. The cashier enters the
 * type, the amount, and a note; time and actor are set by the server.
 */
export function CashMovementSheet({
  drawerCashMinor,
  onClose,
  onSubmit,
  saving,
}: Readonly<{
  /** Cash currently expected in the drawer; cash out cannot exceed it. */
  drawerCashMinor: string;
  onClose: () => void;
  onSubmit: (input: RecordCashMovement) => void;
  saving: boolean;
}>) {
  const t = useTranslations("pos");
  const { locale } = useFormat();
  const formId = useId();
  const amountId = useId();
  const noteId = useId();
  const [direction, setDirection] = useState<CashMovementDirection>("IN");
  const [amount, setAmount] = useState<number | undefined>();
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const amountError =
    amount === undefined || amount <= 0
      ? t("amountRequired")
      : direction === "OUT" && BigInt(amount) > BigInt(drawerCashMinor)
        ? t("cashOutTooMuch")
        : undefined;
  const noteError = note.trim().length < NOTE_MIN_LENGTH ? t("noteRequired") : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (amountError || noteError || amount === undefined || saving) return;
    onSubmit({ amountMinor: String(amount), direction, reason: note.trim() });
  }

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      footer={
        <Button form={formId} loading={saving} loadingLabel={t("saving")} type="submit">
          {t("save")}
        </Button>
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("recordCash")}
    >
      <form className="grid gap-5" id={formId} noValidate onSubmit={submit}>
        <SegmentedControl
          disabled={saving}
          items={[
            { label: t("directionIn"), value: "IN" },
            { label: t("directionOut"), value: "OUT" },
          ]}
          label={t("direction")}
          onValueChange={(value) => setDirection(value as CashMovementDirection)}
          value={direction}
        />
        <FormField
          {...(submitted && amountError ? { error: amountError } : {})}
          htmlFor={amountId}
          label={t("amount")}
        >
          <MoneyInput
            disabled={saving}
            id={amountId}
            locale={locale}
            min={0}
            onValueChange={setAmount}
            size="lg"
            {...(amount === undefined ? {} : { value: amount })}
          />
        </FormField>
        <FormField
          {...(submitted && noteError ? { error: noteError } : {})}
          htmlFor={noteId}
          label={t("note")}
        >
          <Textarea
            disabled={saving}
            id={noteId}
            maxLength={300}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            value={note}
          />
        </FormField>
      </form>
    </Sheet>
  );
}
