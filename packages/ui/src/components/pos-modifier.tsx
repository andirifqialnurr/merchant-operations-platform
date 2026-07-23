"use client";

import { type FormEvent, type ReactNode, useId, useState } from "react";

import { Button } from "./button";
import { Dialog } from "./overlay";
import { Checkbox, QuantityStepper, Radio } from "./selection-control";
import { FormField, Textarea } from "./text-field";

export type ModifierSelectionMode = "single" | "multiple";

export type ModifierOption = {
  disabled?: boolean;
  id: string;
  label: string;
  priceLabel?: ReactNode;
  unavailableLabel?: string;
};

export type ModifierGroup = {
  id: string;
  label: string;
  maxSelections?: number;
  minSelections?: number;
  mode: ModifierSelectionMode;
  options: readonly ModifierOption[];
};

export type ModifierPickerSelections = Record<string, readonly string[]>;

export type ModifierPickerSubmitValue = {
  note: string;
  quantity: number;
  selections: ModifierPickerSelections;
};

export type ProductModifierPickerProps = {
  defaultNote?: string;
  defaultQuantity?: number;
  defaultSelections?: ModifierPickerSelections;
  disabled?: boolean;
  groups: readonly ModifierGroup[];
  loading?: boolean;
  maxQuantity?: number;
  onNoteChange?: (note: string) => void;
  onOpenChange: (open: boolean) => void;
  onQuantityChange?: (quantity: number) => void;
  onSelectionsChange?: (selections: ModifierPickerSelections) => void;
  onSubmit: (value: ModifierPickerSubmitValue) => void;
  open: boolean;
  productDescription?: string;
  productName: string;
  productPriceLabel: ReactNode;
  submitLabel?: string;
  submitTotalLabel?: ReactNode;
  title?: string;
};

function normalizedLimits(group: ModifierGroup) {
  const availableCount = group.options.filter((option) => !option.disabled).length;
  const requestedMinimum = Math.max(0, Math.floor(group.minSelections ?? 0));
  const requestedMaximum =
    group.mode === "single" ? 1 : Math.max(0, Math.floor(group.maxSelections ?? availableCount));
  const minimum = group.mode === "single" ? Math.min(requestedMinimum, 1) : requestedMinimum;
  const maximum = Math.max(minimum, requestedMaximum);

  return { maximum, minimum };
}

function selectionGuidance(minimum: number, maximum: number) {
  if (minimum === maximum && minimum > 0) {
    return `Pilih ${minimum}`;
  }
  if (minimum > 0) {
    return `Pilih ${minimum}-${maximum}`;
  }
  return `Maksimal ${maximum} pilihan`;
}

function copySelections(selections: ModifierPickerSelections | undefined) {
  return Object.fromEntries(
    Object.entries(selections ?? {}).map(([groupId, optionIds]) => [groupId, [...optionIds]]),
  );
}

export function ProductModifierPicker({
  defaultNote = "",
  defaultQuantity = 1,
  defaultSelections,
  disabled = false,
  groups,
  loading = false,
  maxQuantity = 99,
  onNoteChange,
  onOpenChange,
  onQuantityChange,
  onSelectionsChange,
  onSubmit,
  open,
  productDescription,
  productName,
  productPriceLabel,
  submitLabel = "Tambahkan ke keranjang",
  submitTotalLabel,
  title = "Sesuaikan pesanan",
}: ProductModifierPickerProps) {
  const idPrefix = useId();
  const noteId = `${idPrefix}-note`;
  const formId = `${idPrefix}-form`;
  const [note, setNote] = useState(defaultNote);
  const [quantity, setQuantity] = useState(Math.max(1, Math.min(defaultQuantity, maxQuantity)));
  const [selections, setSelections] = useState<ModifierPickerSelections>(() =>
    copySelections(defaultSelections),
  );
  const pickerDisabled = disabled || loading;
  const incompleteGroups = groups.filter((group) => {
    const { minimum } = normalizedLimits(group);
    return (selections[group.id]?.length ?? 0) < minimum;
  });
  const isComplete = incompleteGroups.length === 0;

  function updateGroup(group: ModifierGroup, optionId: string, checked: boolean) {
    const current = selections[group.id] ?? [];
    const { maximum } = normalizedLimits(group);
    let nextGroupSelection: readonly string[];

    if (group.mode === "single") {
      nextGroupSelection = checked ? [optionId] : current;
    } else if (checked) {
      nextGroupSelection = current.includes(optionId)
        ? current
        : [...current, optionId].slice(0, maximum);
    } else {
      nextGroupSelection = current.filter((id) => id !== optionId);
    }

    const nextSelections = { ...selections, [group.id]: nextGroupSelection };
    setSelections(nextSelections);
    onSelectionsChange?.(nextSelections);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pickerDisabled && isComplete) {
      onSubmit({ note, quantity, selections: copySelections(selections) });
    }
  }

  return (
    <Dialog
      description="Pilih varian dan tambahan sebelum memasukkan produk ke keranjang."
      footer={
        <div className="ui-modifier-picker__footer">
          {submitTotalLabel ? (
            <div className="ui-modifier-picker__total">
              <span>Total</span>
              <strong>{submitTotalLabel}</strong>
            </div>
          ) : null}
          <Button
            disabled={pickerDisabled || !isComplete}
            form={formId}
            fullWidth
            loading={loading}
            size="lg"
            type="submit"
          >
            {submitLabel}
          </Button>
        </div>
      }
      onOpenChange={onOpenChange}
      open={open}
      size="lg"
      title={title}
    >
      <form className="ui-modifier-picker" id={formId} onSubmit={submit}>
        <section aria-label="Ringkasan produk" className="ui-modifier-picker__summary">
          <div>
            <h3>{productName}</h3>
            {productDescription ? <p>{productDescription}</p> : null}
          </div>
          <strong>{productPriceLabel}</strong>
        </section>

        <div className="ui-modifier-picker__groups">
          {groups.map((group) => {
            const selectedIds = selections[group.id] ?? [];
            const { maximum, minimum } = normalizedLimits(group);
            const incomplete = selectedIds.length < minimum;
            const maximumReached = selectedIds.length >= maximum;
            const guidanceId = `${idPrefix}-${group.id}-guidance`;

            return (
              <fieldset
                aria-describedby={guidanceId}
                aria-invalid={incomplete || undefined}
                className={`ui-modifier-picker__group${incomplete ? " is-incomplete" : ""}`}
                disabled={pickerDisabled}
                key={group.id}
              >
                <legend>
                  <span>{group.label}</span>
                  <span className="ui-modifier-picker__requirement">
                    {minimum > 0 ? "Wajib" : "Opsional"}
                  </span>
                </legend>
                <p className="ui-modifier-picker__guidance" id={guidanceId}>
                  <span>{selectionGuidance(minimum, maximum)}</span>
                  {incomplete ? <strong>Belum lengkap</strong> : null}
                </p>
                <div className="ui-modifier-picker__options">
                  {group.options.map((option) => {
                    const checked = selectedIds.includes(option.id);
                    const optionDisabled =
                      Boolean(option.disabled) ||
                      (group.mode === "multiple" && maximumReached && !checked);
                    const optionLabel = (
                      <span className="ui-modifier-picker__option-content">
                        <span>
                          <strong>{option.label}</strong>
                          {option.disabled && option.unavailableLabel ? (
                            <small>{option.unavailableLabel}</small>
                          ) : null}
                        </span>
                        {option.priceLabel ? <span>{option.priceLabel}</span> : null}
                      </span>
                    );
                    const accessibleOptionLabel = [
                      option.label,
                      option.unavailableLabel,
                      typeof option.priceLabel === "string" ? option.priceLabel : undefined,
                    ]
                      .filter(Boolean)
                      .join(", ");

                    return group.mode === "single" ? (
                      <Radio
                        aria-label={accessibleOptionLabel}
                        checked={checked}
                        className="ui-modifier-picker__option"
                        disabled={optionDisabled}
                        key={option.id}
                        label={optionLabel}
                        name={`${idPrefix}-${group.id}`}
                        onChange={(event) =>
                          updateGroup(group, option.id, event.currentTarget.checked)
                        }
                        size="lg"
                        value={option.id}
                      />
                    ) : (
                      <Checkbox
                        aria-label={accessibleOptionLabel}
                        checked={checked}
                        className="ui-modifier-picker__option"
                        disabled={optionDisabled}
                        key={option.id}
                        label={optionLabel}
                        onChange={(event) =>
                          updateGroup(group, option.id, event.currentTarget.checked)
                        }
                        size="lg"
                        value={option.id}
                      />
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>

        <FormField
          helperText="Opsional. Catatan akan diteruskan ke kasir atau dapur."
          htmlFor={noteId}
          label="Catatan item"
        >
          <Textarea
            autoGrow
            disabled={pickerDisabled}
            id={noteId}
            maxLength={240}
            onChange={(event) => {
              const nextNote = event.currentTarget.value;
              setNote(nextNote);
              onNoteChange?.(nextNote);
            }}
            placeholder="Contoh: es sedikit, tanpa sedotan"
            rows={3}
            value={note}
          />
        </FormField>

        <div className="ui-modifier-picker__quantity">
          <div>
            <strong>Jumlah</strong>
            <span>Maksimal {maxQuantity} per item</span>
          </div>
          <QuantityStepper
            disabled={pickerDisabled}
            label={productName}
            max={maxQuantity}
            min={1}
            onValueChange={(nextQuantity) => {
              setQuantity(nextQuantity);
              onQuantityChange?.(nextQuantity);
            }}
            size="lg"
            value={quantity}
          />
        </div>
      </form>
    </Dialog>
  );
}
