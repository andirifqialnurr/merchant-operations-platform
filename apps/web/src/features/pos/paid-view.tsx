"use client";

import { useTranslations } from "next-intl";

import type { Checkout } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { MoneyDisplay } from "@merchant/ui/money-display";

import { useFormat } from "@/lib/i18n";

/** The result of a payment: sale number, total, and for cash the change to hand back. */
export function PaidView({
  actionLabel,
  checkout,
  onDone,
}: Readonly<{ actionLabel: string; checkout: Checkout; onDone: () => void }>) {
  const t = useTranslations("pos");
  const { locale } = useFormat();
  const { payment, sale } = checkout;
  const row = "flex items-baseline justify-between gap-3 py-3";

  return (
    <div className="mx-auto grid w-full max-w-md gap-6">
      <h1 className="m-0 text-heading-lg">{t("paid")}</h1>
      <dl className="m-0 divide-y divide-line-subtle border-y border-line-default">
        <div className={row}>
          <dt className="text-body-sm text-foreground-secondary">{t("saleNumber")}</dt>
          <dd className="m-0 text-label font-semibold">#{sale.saleNumber}</dd>
        </div>
        <div className={row}>
          <dt className="text-body-sm text-foreground-secondary">{t("total")}</dt>
          <dd className="m-0">
            <MoneyDisplay amountMinor={sale.totalMinor} locale={locale} />
          </dd>
        </div>
        {payment.tenderedMinor !== null && payment.changeMinor !== null ? (
          <>
            <div className={row}>
              <dt className="text-body-sm text-foreground-secondary">{t("tendered")}</dt>
              <dd className="m-0">
                <MoneyDisplay amountMinor={payment.tenderedMinor} locale={locale} />
              </dd>
            </div>
            <div className={row}>
              <dt className="text-label font-semibold">{t("change")}</dt>
              <dd className="m-0">
                <MoneyDisplay amountMinor={payment.changeMinor} locale={locale} variant="total" />
              </dd>
            </div>
          </>
        ) : null}
      </dl>
      <Button fullWidth onClick={onDone} size="lg">
        {actionLabel}
      </Button>
    </div>
  );
}
