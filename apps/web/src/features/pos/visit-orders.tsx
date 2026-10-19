"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { rejectGuestOrderSchema } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { Badge } from "@merchant/ui/feedback";
import { MoneyDisplay } from "@merchant/ui/money-display";
import { FormField, Textarea } from "@merchant/ui/textarea";

import { useFormat } from "@/lib/i18n";

import { isPendingGuestOrder, visitOrderLabel, type VisitOrder } from "./table-order-state";

export type GuestOrderDecision =
  { decision: "accept"; orderId: string } | { decision: "reject"; orderId: string; reason: string };

/** Snapshot review and decisions stay on the existing visit, with no nested card/modal. */
export function VisitOrders({
  orders,
  busy,
  canAccept,
  canReject,
  reviewable,
  onDecision,
  activeOrderId,
}: Readonly<{
  orders: readonly VisitOrder[];
  busy: boolean;
  activeOrderId: string | undefined;
  canAccept: boolean;
  canReject: boolean;
  reviewable: boolean;
  onDecision: (input: GuestOrderDecision) => Promise<unknown>;
}>) {
  const t = useTranslations("floor");
  const { locale } = useFormat();
  const reasonId = useId();
  const [rejecting, setRejecting] = useState<{ orderId: string; reason: string }>();
  const [invalid, setInvalid] = useState(false);

  function focusOrder(orderId: string) {
    requestAnimationFrame(() => document.getElementById(`${reasonId}-order-${orderId}`)?.focus());
  }

  function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejecting || busy || !reviewable || !canReject) return;
    const parsed = rejectGuestOrderSchema.safeParse({ reason: rejecting.reason });
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    void onDecision({ decision: "reject", orderId: rejecting.orderId, reason: parsed.data.reason })
      .then(() => {
        setRejecting(undefined);
        focusOrder(rejecting.orderId);
      })
      .catch(() => {
        /* Retain the input; the mutation hook reports and refreshes errors. */
      });
  }

  if (orders.length === 0)
    return <p className="m-0 text-body-sm text-foreground-secondary">{t("noOrders")}</p>;
  return (
    <section aria-label={t("ordersTitle")}>
      <h3 className="m-0 text-label font-semibold">{t("ordersTitle")}</h3>
      <ul className="m-0 list-none divide-y divide-line-subtle p-0">
        {orders.map((order) => {
          const pending = isPendingGuestOrder(order);
          const editing = pending && rejecting?.orderId === order.id && canReject;
          return (
            <li
              aria-label={t("orderNumber", { number: order.orderNumber })}
              id={`${reasonId}-order-${order.id}`}
              tabIndex={-1}
              className="grid min-w-0 gap-3 py-4"
              key={order.id}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong className="text-label font-semibold">
                  {t("orderNumber", { number: order.orderNumber })}
                </strong>
                <span className="flex flex-wrap items-baseline gap-2">
                  {pending ? (
                    <span className="text-caption text-foreground-secondary">
                      {t("orderEstimate")}
                    </span>
                  ) : null}
                  <MoneyDisplay amountMinor={order.totalMinor} locale={locale} />
                </span>
              </div>
              <div>
                <Badge
                  tone={
                    pending
                      ? "warning"
                      : order.paid && order.status !== "CANCELED"
                        ? "success"
                        : "neutral"
                  }
                >
                  {t(visitOrderLabel(order))}
                </Badge>
              </div>
              <ul className="m-0 grid list-none gap-2 p-0 text-body-sm">
                {order.lines.map((line, index) => (
                  <li className="min-w-0 break-words" key={index}>
                    <span>{t("orderLine", { name: line.name, quantity: line.quantity })}</span>
                    {line.modifiers.length > 0 ? (
                      <span className="text-foreground-secondary">
                        {" "}
                        · {line.modifiers.join(", ")}
                      </span>
                    ) : null}
                    {line.note ? (
                      <p className="m-0 whitespace-pre-wrap text-foreground-secondary">
                        {line.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {order.note ? (
                <p className="m-0 break-words whitespace-pre-wrap text-body-sm text-foreground-secondary">
                  {order.note}
                </p>
              ) : null}
              {editing ? (
                <form className="grid gap-3" noValidate onSubmit={reject}>
                  <FormField
                    {...(invalid ? { error: t("rejectReasonInvalid") } : {})}
                    htmlFor={reasonId}
                    label={t("rejectReason")}
                  >
                    <Textarea
                      autoFocus
                      disabled={busy || !reviewable}
                      id={reasonId}
                      maxLength={300}
                      onChange={(event) => {
                        setRejecting({ orderId: order.id, reason: event.target.value });
                        setInvalid(false);
                      }}
                      rows={3}
                      value={rejecting.reason}
                    />
                  </FormField>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="lg"
                      disabled={!reviewable}
                      loading={busy}
                      loadingLabel={t("saving")}
                      type="submit"
                      variant={reviewable ? "primary" : "secondary"}
                    >
                      {t("rejectGuestOrder")}
                    </Button>
                    <Button
                      size="lg"
                      disabled={busy}
                      onClick={() => {
                        setRejecting(undefined);
                        requestAnimationFrame(() =>
                          document.getElementById(`${reasonId}-reject-${order.id}`)?.focus(),
                        );
                      }}
                      variant="ghost"
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                </form>
              ) : pending && (canAccept || canReject) ? (
                <div className="flex flex-wrap gap-2">
                  {canAccept ? (
                    <Button
                      size="lg"
                      disabled={busy || !reviewable || !!rejecting}
                      loading={busy && activeOrderId === order.id}
                      loadingLabel={t("saving")}
                      onClick={() =>
                        void onDecision({ decision: "accept", orderId: order.id })
                          .then(() => focusOrder(order.id))
                          .catch(() => focusOrder(order.id))
                      }
                      variant="secondary"
                    >
                      {t("acceptGuestOrder")}
                    </Button>
                  ) : null}
                  {canReject ? (
                    <Button
                      size="lg"
                      disabled={busy || !reviewable || !!rejecting}
                      id={`${reasonId}-reject-${order.id}`}
                      onClick={() => {
                        setRejecting({ orderId: order.id, reason: "" });
                        setInvalid(false);
                      }}
                      variant="ghost"
                    >
                      {t("rejectGuestOrder")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
