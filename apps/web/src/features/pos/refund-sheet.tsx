"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@merchant/ui/button";
import { ErrorState, Skeleton } from "@merchant/ui/feedback";
import { MoneyDisplay } from "@merchant/ui/money-display";
import { MoneyInput } from "@merchant/ui/money-input";
import { Chip } from "@merchant/ui/page";
import { Sheet } from "@merchant/ui/sheet";
import { FormField, Textarea } from "@merchant/ui/textarea";

import { merchantApi } from "@/lib/api-client";
import { useErrorMessage, useFormat } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";

import { orderKeys, shiftKeys, useReceipt } from "./api";

const REASON_MIN_LENGTH = 3;

const methodKeys = {
  CASH: "methodCash",
  EDC: "methodEdc",
  MERCHANT_QRIS: "methodQris",
  OTHER: "methodOther",
  TRANSFER: "methodTransfer",
} as const;

/**
 * Refunds part or all of a paid order. The cashier enters the amount and a
 * reason; the method is always the one the order was paid with, and what is
 * still refundable comes from the server.
 */
export function RefundSheet({
  onClose,
  orderId,
  outletId,
  tenantId,
}: Readonly<{ onClose: () => void; orderId: string; outletId: string; tenantId: string }>) {
  const t = useTranslations("pos");
  const { dateTime, locale, money } = useFormat();
  const errorMessage = useErrorMessage();
  const notify = useToast();
  const queryClient = useQueryClient();
  const amountId = useId();
  const reasonId = useId();
  const receipt = useReceipt(tenantId, outletId, orderId);
  const [amount, setAmount] = useState<number | undefined>();
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  // One key per intended refund, so a retry after a lost response is not paid twice.
  const [refundKey, setRefundKey] = useState(() => crypto.randomUUID());

  const refundable = receipt.data ? BigInt(receipt.data.refundableMinor) : 0n;
  const amountError =
    amount === undefined || amount <= 0
      ? t("amountRequired")
      : BigInt(amount) > refundable
        ? t("refundTooMuch", { max: money(refundable.toString()) })
        : undefined;
  const reasonError =
    reason.trim().length < REASON_MIN_LENGTH ? t("refundReasonRequired") : undefined;

  const refund = useMutation({
    mutationFn: () =>
      merchantApi.refundOrder(
        tenantId,
        outletId,
        orderId,
        { amountMinor: String(amount), reason: reason.trim() },
        refundKey,
      ),
    onError: (error) => notify({ message: errorMessage(error), tone: "danger" }),
    onSuccess: async () => {
      setRefundKey(crypto.randomUUID());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.list(tenantId, outletId) }),
        queryClient.invalidateQueries({ queryKey: orderKeys.receipt(tenantId, outletId, orderId) }),
        queryClient.invalidateQueries({ queryKey: shiftKeys.current(tenantId, outletId) }),
      ]);
      notify({ message: t("refundRecorded"), tone: "success" });
      onClose();
    },
  });

  const data = receipt.data;
  const canRefund = refundable > 0n;

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      {...(data && canRefund
        ? {
            footer: (
              <Button
                loading={refund.isPending}
                loadingLabel={t("refunding")}
                onClick={() => {
                  setSubmitted(true);
                  if (!amountError && !reasonError) refund.mutate();
                }}
                variant="destructive"
              >
                {t("refund")}
              </Button>
            ),
          }
        : {})}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("refundTitle", { number: data?.order.orderNumber ?? "" })}
    >
      {!data ? (
        receipt.isError ? (
          <ErrorState description={errorMessage(receipt.error)} title={t("receiptLoadFailed")} />
        ) : (
          <Skeleton variant="table-row" />
        )
      ) : (
        <div className="grid gap-5">
          <dl className="m-0 grid gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-body-sm text-foreground-secondary">{t("method")}</dt>
              <dd className="m-0">{t(methodKeys[data.payment.method])}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-label font-semibold">{t("refundable")}</dt>
              <dd className="m-0">
                <MoneyDisplay
                  amountMinor={data.refundableMinor}
                  locale={locale}
                  variant="summary"
                />
              </dd>
            </div>
          </dl>

          {data.refunds.length > 0 ? (
            <ul className="m-0 list-none divide-y divide-line-subtle border-y border-line-default p-0">
              {data.refunds.map((item) => (
                <li className="flex items-start justify-between gap-3 py-3" key={item.id}>
                  <div className="min-w-0">
                    <p className="m-0">{item.reason}</p>
                    <p className="m-0 text-body-sm text-foreground-secondary">
                      {dateTime(item.createdAt)}
                    </p>
                  </div>
                  <MoneyDisplay amountMinor={`-${item.amountMinor}`} locale={locale} />
                </li>
              ))}
            </ul>
          ) : null}

          {canRefund ? (
            <>
              <FormField
                {...(submitted && amountError ? { error: amountError } : {})}
                htmlFor={amountId}
                label={t("refundAmount")}
              >
                <MoneyInput
                  disabled={refund.isPending}
                  id={amountId}
                  locale={locale}
                  min={0}
                  onValueChange={setAmount}
                  size="lg"
                  {...(amount === undefined ? {} : { value: amount })}
                />
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Chip
                  disabled={refund.isPending}
                  onClick={() => setAmount(Number(refundable))}
                  selected={amount !== undefined && BigInt(amount) === refundable}
                >
                  {t("refundAll")}
                </Chip>
              </div>
              <FormField
                {...(submitted && reasonError ? { error: reasonError } : {})}
                htmlFor={reasonId}
                label={t("refundReason")}
              >
                <Textarea
                  disabled={refund.isPending}
                  id={reasonId}
                  maxLength={300}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  value={reason}
                />
              </FormField>
            </>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
