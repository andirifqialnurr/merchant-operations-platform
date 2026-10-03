"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { IconNote, IconTrash } from "@tabler/icons-react";

import { Button, IconButton } from "@merchant/ui/button";
import { MoneyDisplay } from "@merchant/ui/money-display";
import { Input } from "@merchant/ui/input";
import { QuantityStepper } from "@merchant/ui/selection-control";

import { useFormat } from "@/lib/i18n";

import { MAX_LINE_QUANTITY, MAX_NOTE_LENGTH, type CartLineView } from "./cart";

/**
 * The cart: what was chosen, how many, and the total. The total appears here
 * and nowhere else on the sell screen.
 */
export function CartPanel({
  lines,
  onHold,
  onNoteChange,
  onPay,
  onQuantityChange,
  onRemove,
  totalMinor,
}: Readonly<{
  lines: readonly CartLineView[];
  onHold: () => void;
  onNoteChange: (key: string, note: string) => void;
  /** Omitted when the cashier may not take payments. */
  onPay?: (() => void) | undefined;
  onQuantityChange: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  totalMinor: bigint;
}>) {
  const t = useTranslations("pos");
  const { locale } = useFormat();
  const [editing, setEditing] = useState<string | undefined>();
  const [draft, setDraft] = useState("");

  function saveNote(key: string) {
    onNoteChange(key, draft);
    setEditing(undefined);
  }

  if (lines.length === 0) {
    return <p className="p-4 text-body-sm text-foreground-secondary">{t("cartEmpty")}</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="m-0 flex-1 list-none divide-y divide-line-subtle overflow-y-auto p-0">
        {lines.map((item) => (
          <li className="grid gap-2 px-4 py-3" key={item.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-label font-semibold">{item.name}</p>
                {item.choices.length > 0 ? (
                  <p className="m-0 text-body-sm text-foreground-secondary">
                    {item.choices.join(" · ")}
                  </p>
                ) : null}
                {item.line.note && editing !== item.key ? (
                  <p className="m-0 text-body-sm text-foreground-secondary">“{item.line.note}”</p>
                ) : null}
              </div>
              <MoneyDisplay amountMinor={item.lineTotalMinor} locale={locale} />
            </div>
            {editing === item.key ? (
              <Input
                aria-label={t("noteFor", { name: item.name })}
                autoFocus
                maxLength={MAX_NOTE_LENGTH}
                onBlur={() => saveNote(item.key)}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveNote(item.key);
                  if (event.key === "Escape") setEditing(undefined);
                }}
                size="sm"
                value={draft}
              />
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <QuantityStepper
                decreaseLabel={t("decrease", { name: item.name })}
                increaseLabel={t("increase", { name: item.name })}
                label={item.name}
                max={MAX_LINE_QUANTITY}
                min={1}
                onValueChange={(quantity) => onQuantityChange(item.key, quantity)}
                size="sm"
                value={item.line.quantity}
              />
              <div className="flex items-center gap-1">
                <IconButton
                  icon={IconNote}
                  label={t("noteFor", { name: item.name })}
                  onClick={() => {
                    setDraft(item.line.note ?? "");
                    setEditing(item.key);
                  }}
                  size="sm"
                />
                <IconButton
                  icon={IconTrash}
                  label={t("remove", { name: item.name })}
                  onClick={() => onRemove(item.key)}
                  size="sm"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 border-t border-line-default p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-label font-semibold">{t("total")}</span>
          <MoneyDisplay amountMinor={totalMinor} locale={locale} variant="summary" />
        </div>
        <div className="flex gap-2">
          <Button onClick={onHold} size="lg" variant="secondary">
            {t("hold")}
          </Button>
          {onPay ? (
            <div className="min-w-0 flex-1">
              <Button fullWidth onClick={onPay} size="lg">
                {t("pay")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
