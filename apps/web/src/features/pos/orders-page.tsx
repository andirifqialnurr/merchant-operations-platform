"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { PERMISSIONS, type Checkout, type Order, type PosOrderSummary } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { DataTable } from "@merchant/ui/data-display";
import { Badge, EmptyState, ErrorState, Skeleton } from "@merchant/ui/feedback";
import { FormField, Textarea } from "@merchant/ui/textarea";
import { MoneyDisplay } from "@merchant/ui/money-display";
import { PageHeader } from "@merchant/ui/page";
import { Sheet } from "@merchant/ui/sheet";

import { useWorkspace } from "@/features/workspace";
import { merchantApi } from "@/lib/api-client";
import { useErrorMessage, useFormat } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";

import { orderKeys, useOrder, useOrders } from "./api";
import { PaidView } from "./paid-view";
import { PaymentView } from "./payment-view";

const REASON_MIN_LENGTH = 3;

function OrderState({
  order,
}: Readonly<{ order: Pick<PosOrderSummary, "paymentState" | "status"> }>) {
  const t = useTranslations("pos");
  if (order.status === "CANCELED") return <Badge>{t("stateCanceled")}</Badge>;
  if (order.paymentState === "PAID") return <Badge tone="success">{t("paid")}</Badge>;
  return <Badge tone="warning">{t("stateUnpaid")}</Badge>;
}

/**
 * One order: its lines and total, and what can still be done with it. Paying
 * hands over to the payment view; cancelling asks for a reason first.
 */
function OrderSheet({
  canCancel,
  canPay,
  onClose,
  onPay,
  orderId,
  outletId,
  summary,
  tenantId,
}: Readonly<{
  canCancel: boolean;
  canPay: boolean;
  onClose: () => void;
  onPay: (order: Order) => void;
  orderId: string;
  outletId: string;
  summary: PosOrderSummary;
  tenantId: string;
}>) {
  const t = useTranslations("pos");
  const { locale } = useFormat();
  const errorMessage = useErrorMessage();
  const notify = useToast();
  const queryClient = useQueryClient();
  const reasonId = useId();
  const detail = useOrder(tenantId, outletId, orderId);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const cancel = useMutation({
    mutationFn: () =>
      merchantApi.cancelOrder(tenantId, outletId, orderId, { reason: reason.trim() }),
    onError: (error) => {
      notify({ message: errorMessage(error), tone: "danger" });
      void queryClient.invalidateQueries({ queryKey: orderKeys.list(tenantId, outletId) });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orderKeys.list(tenantId, outletId) });
      notify({ message: t("orderCanceled"), tone: "success" });
      onClose();
    },
  });

  const open = summary.status !== "CANCELED" && summary.paymentState === "UNPAID";
  const reasonTooShort = reason.trim().length < REASON_MIN_LENGTH;
  const order = detail.data;

  let footer = null;
  if (open && cancelling) {
    footer = (
      <>
        <Button disabled={cancel.isPending} onClick={() => setCancelling(false)} variant="ghost">
          {t("back")}
        </Button>
        <Button
          loading={cancel.isPending}
          loadingLabel={t("cancelling")}
          onClick={() => {
            setSubmitted(true);
            if (!reasonTooShort) cancel.mutate();
          }}
          variant="destructive"
        >
          {t("cancelOrder")}
        </Button>
      </>
    );
  } else if (open && order) {
    footer = (
      <>
        {canCancel ? (
          <Button onClick={() => setCancelling(true)} variant="secondary">
            {t("cancelOrder")}
          </Button>
        ) : null}
        {canPay ? <Button onClick={() => onPay(order)}>{t("pay")}</Button> : null}
      </>
    );
  }

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      {...(footer ? { footer } : {})}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open
      title={t("orderTitle", { number: summary.orderNumber })}
    >
      {!order ? (
        detail.isError ? (
          <ErrorState description={errorMessage(detail.error)} title={t("loadFailed")} />
        ) : (
          <Skeleton variant="table-row" />
        )
      ) : (
        <div className="grid gap-5">
          <div className="flex items-center justify-between gap-3">
            <OrderState order={summary} />
            {summary.saleNumber !== null ? (
              <span className="text-body-sm text-foreground-secondary">
                {t("saleNumber")} #{summary.saleNumber}
              </span>
            ) : null}
          </div>

          <ul className="m-0 list-none divide-y divide-line-subtle border-y border-line-default p-0">
            {order.items.map((item) => {
              const choices = [
                ...(item.variantName ? [item.variantName] : []),
                ...item.modifiers.map((modifier) => modifier.optionName),
              ];
              return (
                <li className="flex items-start justify-between gap-3 py-3" key={item.id}>
                  <div className="min-w-0">
                    <p className="m-0 text-label font-semibold">
                      {item.quantity}× {item.name}
                    </p>
                    {choices.length > 0 ? (
                      <p className="m-0 text-body-sm text-foreground-secondary">
                        {choices.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <MoneyDisplay amountMinor={item.lineTotalMinor} locale={locale} />
                </li>
              );
            })}
          </ul>

          <div className="flex items-baseline justify-between gap-3">
            <span className="text-label font-semibold">{t("total")}</span>
            <MoneyDisplay amountMinor={order.subtotalMinor} locale={locale} variant="summary" />
          </div>

          {order.cancelReason ? (
            <div className="grid gap-1">
              <span className="text-body-sm text-foreground-secondary">{t("cancelReason")}</span>
              <p className="m-0">{order.cancelReason}</p>
            </div>
          ) : null}

          {open && cancelling ? (
            <FormField
              {...(submitted && reasonTooShort ? { error: t("cancelReasonRequired") } : {})}
              htmlFor={reasonId}
              label={t("cancelReason")}
            >
              <Textarea
                autoFocus
                disabled={cancel.isPending}
                id={reasonId}
                maxLength={300}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                value={reason}
              />
            </FormField>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}

function OrdersForOutlet({
  canCancel,
  canPay,
  outletId,
  tenantId,
}: Readonly<{ canCancel: boolean; canPay: boolean; outletId: string; tenantId: string }>) {
  const t = useTranslations("pos");
  const { dateTime, locale } = useFormat();
  const errorMessage = useErrorMessage();
  const orders = useOrders(tenantId, outletId);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [paying, setPaying] = useState<Order | undefined>();
  const [checkout, setCheckout] = useState<Checkout | undefined>();

  if (checkout) {
    return (
      <PaidView
        actionLabel={t("backToOrders")}
        checkout={checkout}
        onDone={() => setCheckout(undefined)}
      />
    );
  }

  if (paying) {
    return (
      <PaymentView
        onBack={() => setPaying(undefined)}
        onPaid={(result) => {
          setPaying(undefined);
          setCheckout(result);
        }}
        outletId={outletId}
        source={{ kind: "order", order: paying }}
        tenantId={tenantId}
      />
    );
  }

  const header = <PageHeader title={t("orders")} />;

  if (orders.isPending) {
    return (
      <>
        {header}
        <div className="grid gap-2">
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
        </div>
      </>
    );
  }

  if (orders.isError) {
    return (
      <>
        {header}
        <ErrorState
          action={
            <Button onClick={() => void orders.refetch()} variant="secondary">
              {t("retry")}
            </Button>
          }
          description={errorMessage(orders.error)}
          title={t("ordersLoadFailed")}
        />
      </>
    );
  }

  const rows = orders.data.orders;
  const selected = rows.find((order) => order.id === selectedId);

  return (
    <>
      {header}
      {rows.length === 0 ? (
        <EmptyState description={t("ordersEmpty")} title={t("ordersEmptyTitle")} />
      ) : (
        <DataTable
          caption={t("orders")}
          columns={[
            t("orderNumber"),
            { label: t("time"), priority: 2 },
            { align: "end", label: t("items"), priority: 2 },
            { align: "end", label: t("total") },
            t("state"),
          ]}
          onRowSelect={(index) => setSelectedId(rows[index]?.id)}
          rows={rows.map((order) => [
            `#${order.orderNumber}`,
            dateTime(order.createdAt),
            order.itemCount,
            <MoneyDisplay amountMinor={order.subtotalMinor} key="total" locale={locale} />,
            <OrderState key="state" order={order} />,
          ])}
        />
      )}
      {selected ? (
        <OrderSheet
          canCancel={canCancel}
          canPay={canPay}
          key={selected.id}
          onClose={() => setSelectedId(undefined)}
          onPay={(order) => {
            setSelectedId(undefined);
            setPaying(order);
          }}
          orderId={selected.id}
          outletId={outletId}
          summary={selected}
          tenantId={tenantId}
        />
      ) : null}
    </>
  );
}

/** Orders of the last 24 hours at the active outlet: pay later or cancel. */
export function OrdersPage() {
  const t = useTranslations("pos");
  const { can, outlet, workspace } = useWorkspace();

  if (!can(PERMISSIONS.orderCreate)) {
    return <ErrorState description={t("accessDenied")} title={t("accessDeniedTitle")} />;
  }
  if (!outlet) {
    return <ErrorState description={t("noOutlet")} title={t("accessDeniedTitle")} />;
  }

  return (
    <OrdersForOutlet
      canCancel={can(PERMISSIONS.orderCancel)}
      canPay={can(PERMISSIONS.paymentConfirm)}
      key={`${workspace.tenant.id}:${outlet.id}`}
      outletId={outlet.id}
      tenantId={workspace.tenant.id}
    />
  );
}
