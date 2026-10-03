"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import type { SellableMenuModifierGroup, SellableMenuProduct } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { Checkbox, QuantityStepper, Radio } from "@merchant/ui/selection-control";
import { FormField, Input } from "@merchant/ui/input";
import { Sheet } from "@merchant/ui/sheet";

import { useFormat } from "@/lib/i18n";

import {
  isLineComplete,
  MAX_LINE_QUANTITY,
  MAX_NOTE_LENGTH,
  unitPrice,
  type CartLine,
} from "./cart";

/** Stretches the option label so its surcharge sits at the end of the row. */
const OPTION_ROW = "flex w-full [&>span:last-child]:flex-1";

function OptionLabel({
  name,
  priceDeltaMinor,
}: Readonly<{ name: string; priceDeltaMinor: string }>) {
  const { money } = useFormat();
  return (
    <span className="flex w-full items-baseline justify-between gap-3">
      <span>{name}</span>
      {priceDeltaMinor !== "0" ? (
        <span className="text-body-sm text-foreground-secondary">+{money(priceDeltaMinor)}</span>
      ) : null}
    </span>
  );
}

/**
 * Chooses the variant, modifiers, and quantity of one product. The cashier
 * only picks; the price shown is derived from the menu.
 */
export function ProductOptionsSheet({
  onAdd,
  onClose,
  product,
}: Readonly<{
  onAdd: (line: CartLine) => void;
  onClose: () => void;
  product: SellableMenuProduct;
}>) {
  const t = useTranslations("pos");
  const { money } = useFormat();
  // A single variant needs no decision, so it is chosen up front.
  const [variantId, setVariantId] = useState<string | undefined>(
    product.variants.length === 1 ? product.variants[0]!.id : undefined,
  );
  const [optionIds, setOptionIds] = useState<readonly string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const noteId = useId();

  const line: CartLine = {
    modifierOptionIds: optionIds,
    productId: product.id,
    quantity,
    ...(note.trim() ? { note: note.trim() } : {}),
    ...(variantId ? { variantId } : {}),
  };
  const complete = isLineComplete(product, line);
  const total = unitPrice(product, line) * BigInt(quantity);

  function toggle(group: SellableMenuModifierGroup, optionId: string, checked: boolean) {
    const inGroup = new Set(group.options.map((option) => option.id));
    const others = optionIds.filter((id) => !inGroup.has(id));
    const current = optionIds.filter((id) => inGroup.has(id));
    if (group.maxSelections === 1) {
      setOptionIds(checked ? [...others, optionId] : others);
    } else if (checked) {
      if (current.length < group.maxSelections) setOptionIds([...optionIds, optionId]);
    } else {
      setOptionIds(optionIds.filter((id) => id !== optionId));
    }
  }

  function hint(group: SellableMenuModifierGroup) {
    if (group.minSelections === 0) return t("optionalUpTo", { count: group.maxSelections });
    if (group.minSelections === group.maxSelections) {
      return t("chooseExact", { count: group.minSelections });
    }
    return t("chooseRange", { max: group.maxSelections, min: group.minSelections });
  }

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      footer={
        <div className="flex w-full items-center gap-3">
          <div className="shrink-0">
            <QuantityStepper
              decreaseLabel={t("decrease", { name: product.name })}
              increaseLabel={t("increase", { name: product.name })}
              label={t("quantity")}
              max={MAX_LINE_QUANTITY}
              min={1}
              onValueChange={setQuantity}
              value={quantity}
            />
          </div>
          <div className="min-w-0 flex-1">
            <Button
              disabled={!complete}
              fullWidth
              onClick={() => {
                if (complete) onAdd(line);
              }}
            >
              {t("addWithTotal", { total: money(total.toString()) })}
            </Button>
          </div>
        </div>
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={product.name}
    >
      <div className="grid gap-6">
        {product.variants.length > 0 ? (
          <fieldset className="grid gap-2">
            <legend className="mb-2 flex w-full items-baseline justify-between gap-3">
              <span className="text-label font-semibold">{t("variant")}</span>
              <span className="text-body-sm text-foreground-secondary">
                {t("chooseExact", { count: 1 })}
              </span>
            </legend>
            {product.variants.map((variant) => (
              <Radio
                checked={variantId === variant.id}
                className={OPTION_ROW}
                key={variant.id}
                label={<OptionLabel {...variant} />}
                name={`variant-${product.id}`}
                onChange={() => setVariantId(variant.id)}
                size="lg"
                value={variant.id}
              />
            ))}
          </fieldset>
        ) : null}

        {product.modifierGroups.map((group) => {
          const chosen = group.options.filter((option) => optionIds.includes(option.id)).length;
          const single = group.minSelections === 1 && group.maxSelections === 1;
          return (
            <fieldset className="grid gap-2" key={group.id}>
              <legend className="mb-2 flex w-full items-baseline justify-between gap-3">
                <span className="text-label font-semibold">{group.name}</span>
                <span className="text-body-sm text-foreground-secondary">{hint(group)}</span>
              </legend>
              {group.options.map((option) => {
                const checked = optionIds.includes(option.id);
                return single ? (
                  <Radio
                    checked={checked}
                    className={OPTION_ROW}
                    key={option.id}
                    label={<OptionLabel {...option} />}
                    name={`group-${group.id}`}
                    onChange={() => toggle(group, option.id, true)}
                    size="lg"
                    value={option.id}
                  />
                ) : (
                  <Checkbox
                    checked={checked}
                    className={OPTION_ROW}
                    // Once the group is full, only chosen options stay changeable.
                    disabled={!checked && group.maxSelections > 1 && chosen >= group.maxSelections}
                    key={option.id}
                    label={<OptionLabel {...option} />}
                    onChange={(event) => toggle(group, option.id, event.currentTarget.checked)}
                    size="lg"
                    value={option.id}
                  />
                );
              })}
            </fieldset>
          );
        })}
        <FormField htmlFor={noteId} label={t("note")} optionalLabel={t("optional")}>
          <Input
            id={noteId}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(event) => setNote(event.target.value)}
            value={note}
          />
        </FormField>
      </div>
    </Sheet>
  );
}
