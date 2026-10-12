"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@merchant/ui/button";
import { FormField, Input } from "@merchant/ui/input";
import { emptyQuickItem, QuickItemEntry, type QuickItem } from "@merchant/ui/quick-item-entry";
import { Sheet } from "@merchant/ui/sheet";

import { merchantApi } from "@/lib/api-client";
import { useErrorMessage } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";

import { kitchenKeys } from "./api";

const LABEL_MAX_LENGTH = 60;

/**
 * Adds a ticket by hand, for a kitchen that is not fed by the cashier: a
 * label and free items. Nothing else is asked; the ticket's source, status,
 * and time are the server's.
 */
export function ManualTicketSheet({
  onClose,
  outletId,
  tenantId,
}: Readonly<{ onClose: () => void; outletId: string; tenantId: string }>) {
  const t = useTranslations("kds");
  const errorMessage = useErrorMessage();
  const notify = useToast();
  const queryClient = useQueryClient();
  const labelId = useId();
  const [label, setLabel] = useState("");
  const [items, setItems] = useState<QuickItem[]>(() => [emptyQuickItem()]);
  const [submitted, setSubmitted] = useState(false);
  // One key per open form, so a retried tap does not make a second ticket.
  const [ticketKey] = useState(() => crypto.randomUUID());

  // Lines left empty are not sent; a line with a note but no name is a mistake.
  const named = items.filter((item) => item.name.trim());
  const labelMissing = label.trim().length === 0;
  const itemsInvalid =
    named.length === 0 || items.some((item) => !item.name.trim() && item.note.trim());

  const create = useMutation({
    mutationFn: () =>
      merchantApi.createKitchenTicket(
        tenantId,
        outletId,
        {
          items: named.map((item) => ({
            name: item.name.trim(),
            ...(item.note.trim() ? { note: item.note.trim() } : {}),
            quantity: item.quantity,
          })),
          orderLabel: label.trim(),
        },
        ticketKey,
      ),
    onError: (error) => notify({ message: errorMessage(error), tone: "danger" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: kitchenKeys.queue(tenantId, outletId) });
      notify({ message: t("ticketAdded"), tone: "success" });
      onClose();
    },
  });
  const submit = () => {
    setSubmitted(true);
    if (!labelMissing && !itemsInvalid) create.mutate();
  };

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      footer={
        <Button loading={create.isPending} loadingLabel={t("addingTicket")} onClick={submit}>
          {t("addTicket")}
        </Button>
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("addTicket")}
    >
      <div className="grid gap-5">
        <FormField
          {...(submitted && labelMissing ? { error: t("ticketLabelRequired") } : {})}
          htmlFor={labelId}
          label={t("ticketLabelField")}
        >
          <Input
            autoFocus
            disabled={create.isPending}
            id={labelId}
            maxLength={LABEL_MAX_LENGTH}
            onChange={(event) => setLabel(event.target.value)}
            value={label}
          />
        </FormField>
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="text-label mb-2 p-0">{t("items")}</legend>
          <QuickItemEntry
            {...(submitted && itemsInvalid ? { error: t("itemsRequired") } : {})}
            disabled={create.isPending}
            items={items}
            labels={{
              add: t("addItem"),
              decrease: t("decrease"),
              increase: t("increase"),
              item: (position) => t("itemLabel", { position }),
              name: t("itemName"),
              note: t("itemNote"),
              quantity: t("itemQuantity"),
              remove: (position) => t("removeItem", { position }),
            }}
            onItemsChange={setItems}
          />
        </fieldset>
      </div>
    </Sheet>
  );
}
