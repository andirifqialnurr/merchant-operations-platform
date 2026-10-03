"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconTrash } from "@tabler/icons-react";

import type { CreateOrderItem, ResumedCart } from "@merchant/contracts";
import { Button, IconButton } from "@merchant/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@merchant/ui/feedback";
import { FormField, Input } from "@merchant/ui/input";
import { Sheet } from "@merchant/ui/sheet";

import { merchantApi } from "@/lib/api-client";
import { useErrorMessage, useFormat } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";

import { heldCartKeys, useHeldCarts } from "./api";

const LABEL_MAX_LENGTH = 60;

/** Asks for a label and sets the cart aside; the cashier enters nothing else. */
export function HoldCartSheet({
  items,
  onClose,
  onHeld,
  outletId,
  tenantId,
}: Readonly<{
  items: readonly CreateOrderItem[];
  onClose: () => void;
  onHeld: () => void;
  outletId: string;
  tenantId: string;
}>) {
  const t = useTranslations("pos");
  const errorMessage = useErrorMessage();
  const notify = useToast();
  const queryClient = useQueryClient();
  const labelId = useId();
  const [label, setLabel] = useState("");
  const [submitted, setSubmitted] = useState(false);
  // One key per hold, so a retried tap does not set the cart aside twice.
  const [holdKey] = useState(() => crypto.randomUUID());
  const labelMissing = label.trim().length === 0;

  const hold = useMutation({
    mutationFn: () =>
      merchantApi.holdCart(tenantId, outletId, { items: [...items], label: label.trim() }, holdKey),
    onError: (error) => notify({ message: errorMessage(error), tone: "danger" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: heldCartKeys.list(tenantId, outletId) });
      notify({ message: t("cartHeld"), tone: "success" });
      onHeld();
    },
  });

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      footer={
        <Button
          loading={hold.isPending}
          loadingLabel={t("holding")}
          onClick={() => {
            setSubmitted(true);
            if (!labelMissing) hold.mutate();
          }}
        >
          {t("holdCart")}
        </Button>
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      size="sm"
      title={t("holdCart")}
    >
      <FormField
        {...(submitted && labelMissing ? { error: t("holdLabelRequired") } : {})}
        htmlFor={labelId}
        label={t("holdLabel")}
      >
        <Input
          autoFocus
          disabled={hold.isPending}
          id={labelId}
          maxLength={LABEL_MAX_LENGTH}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              setSubmitted(true);
              if (!labelMissing) hold.mutate();
            }
          }}
          value={label}
        />
      </FormField>
    </Sheet>
  );
}

/**
 * Carts held at the outlet. Resuming one brings it back to an empty cart and
 * removes it from the list; it can also be discarded.
 */
export function HeldCartsSheet({
  canResume,
  onClose,
  onResumed,
  outletId,
  tenantId,
}: Readonly<{
  /** False while the current cart has items; a held cart never mixes into it. */
  canResume: boolean;
  onClose: () => void;
  onResumed: (cart: ResumedCart) => void;
  outletId: string;
  tenantId: string;
}>) {
  const t = useTranslations("pos");
  const { dateTime } = useFormat();
  const errorMessage = useErrorMessage();
  const notify = useToast();
  const queryClient = useQueryClient();
  const carts = useHeldCarts(tenantId, outletId);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: heldCartKeys.list(tenantId, outletId) });

  const resume = useMutation({
    mutationFn: (id: string) => merchantApi.resumeHeldCart(tenantId, outletId, id),
    onError: (error) => {
      notify({ message: errorMessage(error), tone: "danger" });
      void refresh();
    },
    onSuccess: async (cart) => {
      await refresh();
      onResumed(cart);
    },
  });
  const discard = useMutation({
    mutationFn: (id: string) => merchantApi.discardHeldCart(tenantId, outletId, id),
    onError: (error) => notify({ message: errorMessage(error), tone: "danger" }),
    onSettled: () => void refresh(),
  });

  const rows = carts.data?.heldCarts ?? [];

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("heldCarts")}
    >
      {carts.isPending ? (
        <Skeleton variant="table-row" />
      ) : carts.isError ? (
        <ErrorState description={errorMessage(carts.error)} title={t("heldCartsLoadFailed")} />
      ) : rows.length === 0 ? (
        <EmptyState description={t("heldCartsEmpty")} title={t("heldCarts")} />
      ) : (
        <div className="grid gap-3">
          {canResume ? null : (
            <p className="m-0 text-body-sm text-foreground-secondary">
              {t("resumeNeedsEmptyCart")}
            </p>
          )}
          <ul className="m-0 list-none divide-y divide-line-subtle border-y border-line-default p-0">
            {rows.map((cart) => (
              <li className="flex items-center justify-between gap-3 py-3" key={cart.id}>
                <div className="min-w-0">
                  <p className="m-0 text-label font-semibold">{cart.label}</p>
                  <p className="m-0 text-body-sm text-foreground-secondary">
                    {t("heldCartMeta", {
                      count: cart.itemCount,
                      name: cart.createdByName,
                      time: dateTime(cart.createdAt),
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    disabled={discard.isPending || resume.isPending}
                    icon={IconTrash}
                    label={t("discardHeldCart", { label: cart.label })}
                    onClick={() => discard.mutate(cart.id)}
                    size="sm"
                  />
                  <Button
                    disabled={!canResume || resume.isPending}
                    onClick={() => resume.mutate(cart.id)}
                    size="sm"
                    variant="secondary"
                  >
                    {t("resume")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
