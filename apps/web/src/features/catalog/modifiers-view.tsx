"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";

import type { CatalogModifierGroup, CatalogSnapshot } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { DataTable, Divider, Panel } from "@merchant/ui/data-display";
import { EmptyState } from "@merchant/ui/feedback";
import { FormField, Input } from "@merchant/ui/form-field";
import { MoneyInput, NumericInput } from "@merchant/ui/numeric-date";
import { Sheet } from "@merchant/ui/overlay";
import { SegmentedControl } from "@merchant/ui/selection-control";

import { merchantApi, nextCatalogStatus } from "@/lib/api-client";
import { useFormat } from "@/lib/i18n";

import type { CatalogMutation } from "./api";
import { RecordStatusBadge } from "./status";

type Props = {
  canManage: boolean;
  mutation: CatalogMutation;
  onSelect: (id: string | undefined) => void;
  selectedId: string | undefined;
  snapshot: CatalogSnapshot;
  tenantId: string;
};
type SelectionType = "SINGLE" | "MULTIPLE";

function ModifierSheet({
  group,
  mutation,
  onClose,
  snapshot,
  tenantId,
}: Readonly<{
  group: CatalogModifierGroup | undefined;
  mutation: CatalogMutation;
  onClose: () => void;
  snapshot: CatalogSnapshot;
  tenantId: string;
}>) {
  const t = useTranslations("catalog");
  const { locale, money } = useFormat();
  const [name, setName] = useState(group?.name ?? "");
  const [type, setType] = useState<SelectionType>(group?.selectionType ?? "SINGLE");
  const [min, setMin] = useState(String(group?.minSelections ?? 0));
  const [max, setMax] = useState(String(group?.maxSelections ?? 1));
  const [errors, setErrors] = useState<{ name?: string; range?: string }>({});
  const [optionName, setOptionName] = useState("");
  const [optionPrice, setOptionPrice] = useState<number | undefined>();
  const busy = mutation.isPending;
  const options = snapshot.modifierOptions.filter((item) => item.groupId === group?.id);

  function submit(event: FormEvent) {
    event.preventDefault();
    const minSelections = Number(min) || 0;
    // A single-choice group can never allow more than one selection.
    const maxSelections = type === "SINGLE" ? 1 : Number(max) || 1;
    const nextErrors = {
      ...(name.trim().length < 2 ? { name: t("nameRequired") } : {}),
      ...(minSelections > maxSelections ? { range: t("minimumExceedsMaximum") } : {}),
    };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const fields = { maxSelections, minSelections, name: name.trim(), selectionType: type };
    mutation.mutate(
      group
        ? {
            action: () => merchantApi.updateModifierGroup(tenantId, group.id, fields),
            success: t("modifierUpdated"),
          }
        : {
            action: () =>
              merchantApi.createModifierGroup(tenantId, {
                ...fields,
                displayOrder: snapshot.modifierGroups.length,
              }),
            success: t("modifierCreated"),
          },
      { onSuccess: onClose },
    );
  }

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      footer={
        <>
          {group ? (
            <Button
              disabled={busy}
              onClick={() =>
                mutation.mutate(
                  {
                    action: () =>
                      merchantApi.updateModifierGroup(tenantId, group.id, {
                        status: nextCatalogStatus(group.status),
                      }),
                    success: t("modifierUpdated"),
                  },
                  { onSuccess: onClose },
                )
              }
              variant="secondary"
            >
              {group.status === "ACTIVE" ? t("deactivate") : t("activate")}
            </Button>
          ) : null}
          <Button form="modifier-form" loading={busy} loadingLabel={t("saving")} type="submit">
            {t("save")}
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={group?.name ?? t("newModifier")}
    >
      <div className="grid gap-6">
        <form className="grid gap-4" id="modifier-form" noValidate onSubmit={submit}>
          <FormField
            {...(errors.name ? { error: errors.name } : {})}
            htmlFor="modifier-name"
            label={t("modifierName")}
          >
            <Input
              id="modifier-name"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </FormField>
          <div className="grid gap-1.5">
            <span className="text-label">{t("type")}</span>
            <SegmentedControl
              items={[
                { label: t("typeSingle"), value: "SINGLE" },
                { label: t("typeMultiple"), value: "MULTIPLE" },
              ]}
              label={t("type")}
              onValueChange={(value) => setType(value as SelectionType)}
              value={type}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              {...(errors.range ? { error: errors.range } : {})}
              htmlFor="modifier-min"
              label={t("minimum")}
            >
              <NumericInput id="modifier-min" onValueChange={setMin} value={min} />
            </FormField>
            {type === "MULTIPLE" ? (
              <FormField htmlFor="modifier-max" label={t("maximum")}>
                <NumericInput id="modifier-max" onValueChange={setMax} value={max} />
              </FormField>
            ) : null}
          </div>
        </form>

        {group ? (
          <>
            <Divider />
            <section className="grid gap-3">
              <h3 className="text-label">{t("choices")}</h3>
              {options.length === 0 ? (
                <p className="text-body-sm text-foreground-muted">{t("emptyOptions")}</p>
              ) : null}
              {options.map((option) => (
                <div className="flex items-center justify-between gap-3 text-label" key={option.id}>
                  <span
                    className={
                      option.status === "ACTIVE" ? undefined : "text-foreground-muted line-through"
                    }
                  >
                    {option.name}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="numeric-tabular text-foreground-secondary">
                      +{money(option.priceDeltaMinor)}
                    </span>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        mutation.mutate({
                          action: () =>
                            merchantApi.updateModifierOption(tenantId, option.id, {
                              status: nextCatalogStatus(option.status),
                            }),
                          success: t("modifierUpdated"),
                        })
                      }
                      size="xs"
                      variant="ghost"
                    >
                      {option.status === "ACTIVE" ? t("deactivate") : t("activate")}
                    </Button>
                  </span>
                </div>
              ))}
              <div className="grid grid-cols-[1fr_8rem_auto] items-end gap-2">
                <Input
                  aria-label={t("optionName")}
                  onChange={(event) => setOptionName(event.target.value)}
                  placeholder={t("optionName")}
                  value={optionName}
                />
                <MoneyInput
                  aria-label={t("extraPrice")}
                  locale={locale}
                  onValueChange={setOptionPrice}
                  placeholder={t("extraPrice")}
                  {...(optionPrice === undefined ? {} : { value: optionPrice })}
                />
                <Button
                  disabled={busy || optionName.trim().length < 2}
                  onClick={() =>
                    mutation.mutate(
                      {
                        action: () =>
                          merchantApi.createModifierOption(tenantId, {
                            availability: "AVAILABLE",
                            displayOrder: options.length,
                            groupId: group.id,
                            name: optionName.trim(),
                            priceDeltaMinor: String(optionPrice ?? 0),
                          }),
                        success: t("modifierUpdated"),
                      },
                      {
                        onSuccess: () => {
                          setOptionName("");
                          setOptionPrice(undefined);
                        },
                      },
                    )
                  }
                  variant="secondary"
                >
                  {t("add")}
                </Button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

export function ModifiersView({
  canManage,
  mutation,
  onSelect,
  selectedId,
  snapshot,
  tenantId,
}: Readonly<Props>) {
  const t = useTranslations("catalog");
  const groups = snapshot.modifierGroups;
  const selected = groups.find((item) => item.id === selectedId);
  const sheetOpen = canManage && (selectedId === "new" || Boolean(selected));

  return (
    <>
      <Panel>
        <DataTable
          caption={t("modifiers")}
          columns={[
            t("modifiers"),
            { label: t("type"), priority: 2 },
            { align: "end", label: t("choices") },
            t("status"),
          ]}
          empty={<EmptyState description={t("emptyModifiers")} title={t("modifiers")} />}
          {...(canManage ? { onRowSelect: (index: number) => onSelect(groups[index]?.id) } : {})}
          rows={groups.map((item) => [
            item.name,
            t(item.selectionType === "SINGLE" ? "typeSingle" : "typeMultiple"),
            snapshot.modifierOptions.filter(
              (option) => option.groupId === item.id && option.status === "ACTIVE",
            ).length,
            <RecordStatusBadge key="status" status={item.status} />,
          ])}
        />
      </Panel>
      {sheetOpen ? (
        <ModifierSheet
          group={selected}
          key={selected?.id ?? "new"}
          mutation={mutation}
          onClose={() => onSelect(undefined)}
          snapshot={snapshot}
          tenantId={tenantId}
        />
      ) : null}
    </>
  );
}
