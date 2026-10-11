"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { approvalPinSchema } from "@merchant/contracts";

import { Button } from "@merchant/ui/button";
import { ErrorState, Skeleton } from "@merchant/ui/feedback";
import { MoneyDisplay } from "@merchant/ui/money-display";
import { MoneyInput } from "@merchant/ui/money-input";
import { Chip } from "@merchant/ui/page";
import { PinInput } from "@merchant/ui/pin-input";
import { Select } from "@merchant/ui/select";
import { Sheet } from "@merchant/ui/sheet";
import { FormField, Textarea } from "@merchant/ui/textarea";

import { ApiClientError, merchantApi } from "@/lib/api-client";
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
 * still refundable comes from the server. Someone who may not refund on their
 * own asks a person who may: that person is chosen by name and types their PIN.
 */
export function RefundSheet({
  needsApproval,
  onClose,
  orderId,
  outletId,
  tenantId,
}: Readonly<{
  needsApproval: boolean;
  onClose: () => void;
  orderId: string;
  outletId: string;
  tenantId: string;
}>) {
  const t = useTranslations("pos");
  const { dateTime, locale, money, time } = useFormat();
  const errorMessage = useErrorMessage();
  const notify = useToast();
  const queryClient = useQueryClient();
  const amountId = useId();
  const reasonId = useId();
  const pinId = useId();
  const receipt = useReceipt(tenantId, outletId, orderId);
  const [amount, setAmount] = useState<number | undefined>();
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [approverId, setApproverId] = useState<string>();
  const [pin, setPin] = useState("");
  // What the server said about the last PIN; cleared as soon as a new one is typed.
  const [pinRefused, setPinRefused] = useState<string>();
  const approvers = useQuery({
    enabled: needsApproval,
    queryFn: () => merchantApi.refundApprovers(tenantId, outletId),
    queryKey: ["pos", "refund-approvers", tenantId, outletId],
  });
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

  const approverError = needsApproval && !approverId ? t("approverRequired") : undefined;
  const pinError =
    needsApproval && !approvalPinSchema.safeParse(pin).success
      ? t("approvalPinRequired")
      : undefined;

  const refund = useMutation({
    mutationFn: () =>
      merchantApi.refundOrder(
        tenantId,
        outletId,
        orderId,
        {
          amountMinor: String(amount),
          reason: reason.trim(),
          ...(needsApproval && approverId ? { approval: { approverUserId: approverId, pin } } : {}),
        },
        refundKey,
      ),
    onError: (error) => {
      // A refused PIN is explained at the PIN, and the wrong digits are cleared.
      if (error instanceof ApiClientError && error.code === "APPROVAL_PIN_INVALID") {
        const left = Number(error.details?.attemptsLeft);
        setPinRefused(
          Number.isFinite(left) && left > 0
            ? t("approvalPinWrong", { left })
            : t("approvalRefused"),
        );
        setPin("");
        return;
      }
      if (error instanceof ApiClientError && error.code === "APPROVAL_PIN_LOCKED") {
        const until = error.details?.lockedUntil;
        setPinRefused(
          typeof until === "string"
            ? t("approvalPinLocked", { time: time(until) })
            : t("approvalRefused"),
        );
        setPin("");
        return;
      }
      notify({ message: errorMessage(error), tone: "danger" });
    },
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
  const noApprover = needsApproval && approvers.isSuccess && approvers.data.approvers.length === 0;
  // Without anybody to approve there is nothing to submit.
  const canRefund = refundable > 0n && !noApprover;

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
                  if (!amountError && !reasonError && !approverError && !pinError) refund.mutate();
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
              {needsApproval ? (
                <fieldset className="m-0 grid gap-4 border-0 border-t border-line-default p-0 pt-5">
                  <legend className="p-0 text-label font-semibold">{t("approvalTitle")}</legend>
                  <p className="m-0 text-body-sm text-foreground-secondary">{t("approvalHint")}</p>
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
                    <span className="text-label">{t("approver")}</span>
                    <Select
                      {...(submitted && approverError ? { error: approverError } : {})}
                      {...(approverId ? { value: approverId } : {})}
                      disabled={refund.isPending}
                      emptyLabel={t("noApprovers")}
                      label={t("approver")}
                      onValueChange={(value) => {
                        setApproverId(value);
                        setPin("");
                        setPinRefused(undefined);
                      }}
                      options={(approvers.data?.approvers ?? []).map((item) => ({
                        label: item.displayName,
                        value: item.userId,
                      }))}
                      placeholder={t("selectApprover")}
                    />
                  </div>
                  <FormField
                    {...(pinRefused
                      ? { error: pinRefused }
                      : submitted && pinError
                        ? { error: pinError }
                        : {})}
                    htmlFor={pinId}
                    label={t("approvalPin")}
                  >
                    <PinInput
                      disabled={refund.isPending}
                      id={pinId}
                      onValueChange={(value) => {
                        setPin(value);
                        setPinRefused(undefined);
                      }}
                      value={pin}
                    />
                  </FormField>
                </fieldset>
              ) : null}
            </>
          ) : noApprover && refundable > 0n ? (
            <ErrorState description={t("noApproversHint")} title={t("noApprovers")} />
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
