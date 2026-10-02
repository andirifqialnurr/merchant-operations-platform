"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Checkout, CreateOrderItem, Order } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { Alert } from "@merchant/ui/alert";
import { FormField, Input } from "@merchant/ui/input";
import { MoneyDisplay } from "@merchant/ui/money-display";
import { MoneyInput } from "@merchant/ui/money-input";
import { Chip } from "@merchant/ui/page";
import { buildCashPresets } from "@merchant/ui/pos-payment";
import { SegmentedControl } from "@merchant/ui/selection-control";

import { ApiClientError, merchantApi } from "@/lib/api-client";
import { useErrorMessage, useFormat } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";

import { menuKeys, orderKeys, shiftKeys } from "./api";

type Method = "CASH" | "MERCHANT_QRIS";

/** What is being paid: a cart that becomes an order on confirm, or an order taken earlier. */
export type PaymentSource =
  | {
      /** Total derived from the menu; replaced by the order's total once it exists. */
      cartTotalMinor: bigint;
      items: readonly CreateOrderItem[];
      kind: "cart";
      /** One key per cart, so a retry returns the same order. */
      orderKey: string;
    }
  | { kind: "order"; order: Order };

/**
 * Takes the payment for a cart or an earlier order. It replaces whatever was
 * on screen and shows the amount due exactly once. A cart is submitted as an
 * order when the cashier confirms; the amount charged is always the server's
 * total for that order.
 */
export function PaymentView({
  onBack,
  onLater,
  onPaid,
  outletId,
  source,
  tenantId,
}: Readonly<{
  onBack: () => void;
  /** Leaves a submitted but unpaid order in the order list. */
  onLater?: () => void;
  onPaid: (checkout: Checkout, order: Order) => void;
  outletId: string;
  source: PaymentSource;
  tenantId: string;
}>) {
  const t = useTranslations("pos");
  const { locale, money } = useFormat();
  const errorMessage = useErrorMessage();
  const notify = useToast();
  const queryClient = useQueryClient();
  const tenderedId = useId();
  const referenceId = useId();
  const [method, setMethod] = useState<Method>("CASH");
  const [tendered, setTendered] = useState<number | undefined>();
  const [reference, setReference] = useState("");
  const [order, setOrder] = useState<Order | undefined>(
    source.kind === "order" ? source.order : undefined,
  );
  const [repriced, setRepriced] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // One key per order, so a retried confirmation never charges twice.
  const [payKey] = useState(() => crypto.randomUUID());

  const totalMinor = order
    ? BigInt(order.subtotalMinor)
    : source.kind === "cart"
      ? source.cartTotalMinor
      : 0n;
  const tenderedMinor = tendered === undefined ? undefined : BigInt(tendered);
  const tenderedTooLow = tenderedMinor === undefined || tenderedMinor < totalMinor;
  const changeMinor =
    tenderedTooLow || tenderedMinor === undefined ? undefined : tenderedMinor - totalMinor;

  const confirm = useMutation({
    mutationFn: async () => {
      let current = order;
      if (!current && source.kind === "cart") {
        current = await merchantApi.submitPosOrder(
          tenantId,
          outletId,
          { items: [...source.items], orderType: "TAKEAWAY" },
          source.orderKey,
        );
        setOrder(current);
        void queryClient.invalidateQueries({ queryKey: orderKeys.list(tenantId, outletId) });
        // The menu changed since the cart was built: show the new total and
        // let the cashier confirm again instead of charging a surprise.
        if (BigInt(current.subtotalMinor) !== source.cartTotalMinor) {
          setRepriced(true);
          return undefined;
        }
      }
      if (!current) return undefined;
      const due = BigInt(current.subtotalMinor);
      if (method === "CASH" && (tenderedMinor === undefined || tenderedMinor < due)) {
        return undefined;
      }
      const checkout = await merchantApi.payOrder(
        tenantId,
        outletId,
        current.id,
        method === "CASH"
          ? { method, tenderedMinor: String(tenderedMinor) }
          : { method, ...(reference.trim() ? { reference: reference.trim() } : {}) },
        payKey,
      );
      return { checkout, order: current };
    },
    onError: (error) => {
      notify({ message: errorMessage(error), tone: "danger" });
      void queryClient.invalidateQueries({ queryKey: orderKeys.list(tenantId, outletId) });
      if (error instanceof ApiClientError && error.code.startsWith("ORDER_")) {
        void queryClient.invalidateQueries({ queryKey: menuKeys.outlet(tenantId, outletId) });
      }
      if (error instanceof ApiClientError && error.code.startsWith("POS_SHIFT_")) {
        void queryClient.invalidateQueries({ queryKey: shiftKeys.current(tenantId, outletId) });
      }
    },
    onSuccess: (result) => {
      if (!result) return;
      void queryClient.invalidateQueries({ queryKey: shiftKeys.current(tenantId, outletId) });
      void queryClient.invalidateQueries({ queryKey: orderKeys.list(tenantId, outletId) });
      onPaid(result.checkout, result.order);
    },
  });

  function submit() {
    setSubmitted(true);
    if (method === "CASH" && tenderedTooLow) return;
    setRepriced(false);
    confirm.mutate();
  }

  return (
    <div className="mx-auto grid w-full max-w-md gap-6">
      <h1 className="m-0 text-heading-lg">{t("payment")}</h1>

      <div className="flex items-baseline justify-between gap-3 border-b border-line-default pb-4">
        <span className="text-label font-semibold">{t("total")}</span>
        <MoneyDisplay amountMinor={totalMinor} locale={locale} variant="total" />
      </div>

      {repriced ? <Alert tone="warning">{t("priceChanged")}</Alert> : null}

      <SegmentedControl
        disabled={confirm.isPending}
        items={[
          { label: t("methodCash"), value: "CASH" },
          { label: t("methodQris"), value: "MERCHANT_QRIS" },
        ]}
        label={t("method")}
        onValueChange={(value) => setMethod(value as Method)}
        value={method}
      />

      {method === "CASH" ? (
        <div className="grid gap-3">
          <FormField
            {...(submitted && tenderedTooLow ? { error: t("tenderedTooLow") } : {})}
            htmlFor={tenderedId}
            label={t("tendered")}
          >
            <MoneyInput
              disabled={confirm.isPending}
              id={tenderedId}
              locale={locale}
              min={0}
              onValueChange={setTendered}
              size="lg"
              {...(tendered === undefined ? {} : { value: tendered })}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            {buildCashPresets(totalMinor).map((preset) => (
              <Chip
                disabled={confirm.isPending}
                key={preset}
                onClick={() => setTendered(Number(preset))}
                selected={tendered === Number(preset)}
              >
                {money(preset)}
              </Chip>
            ))}
          </div>
          {changeMinor !== undefined ? (
            <div className="flex items-baseline justify-between gap-3" aria-live="polite">
              <span className="text-label font-semibold">{t("change")}</span>
              <MoneyDisplay amountMinor={changeMinor} locale={locale} variant="summary" />
            </div>
          ) : null}
        </div>
      ) : (
        <FormField htmlFor={referenceId} label={t("reference")} optionalLabel={t("optional")}>
          <Input
            disabled={confirm.isPending}
            id={referenceId}
            maxLength={120}
            onChange={(event) => setReference(event.target.value)}
            value={reference}
          />
        </FormField>
      )}

      <div className="grid gap-2">
        <Button
          fullWidth
          loading={confirm.isPending}
          loadingLabel={t("confirming")}
          onClick={submit}
          size="lg"
        >
          {t("confirmPayment")}
        </Button>
        {/* A cart that became an order cannot be edited any more: it is paid now or later. */}
        {order && source.kind === "cart" ? (
          onLater ? (
            <Button disabled={confirm.isPending} fullWidth onClick={onLater} variant="ghost">
              {t("payLater")}
            </Button>
          ) : null
        ) : (
          <Button disabled={confirm.isPending} fullWidth onClick={onBack} variant="ghost">
            {t("back")}
          </Button>
        )}
      </div>
    </div>
  );
}
