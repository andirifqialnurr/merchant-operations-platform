"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";

import type { FloorArea, FloorTable, FloorTableShape, FloorTableSize } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { FormField, Input } from "@merchant/ui/form-field";
import { Sheet } from "@merchant/ui/overlay";
import { Select } from "@merchant/ui/select";
import { QuantityStepper, SegmentedControl } from "@merchant/ui/selection-control";

import { type ApiClientError, merchantApi } from "@/lib/api-client";
import { isLimitReached, LimitReachedState } from "@/shell/limit-reached-state";

import type { FloorMutation } from "./api";
import { Labeled } from "./labeled";
import { SHAPES, SIZES } from "./table-form";

/** Tables > Add table: what it is and where it belongs. It then waits in the tray. */
export function NewTableSheet({
  areas,
  mutation,
  onClose,
  onCreated,
  outletId,
  tenantId,
}: Readonly<{
  /** The active areas of the floor on screen. */
  areas: readonly FloorArea[];
  mutation: FloorMutation;
  onClose: () => void;
  onCreated: (table: FloorTable) => void;
  outletId: string;
  tenantId: string;
}>) {
  const t = useTranslations("floor");
  const labelId = useId();
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [shape, setShape] = useState<FloorTableShape>("SQUARE");
  const [visualSize, setVisualSize] = useState<FloorTableSize>("MEDIUM");
  const [areaId, setAreaId] = useState(areas[0]?.id ?? "");
  const [errors, setErrors] = useState<{ area?: string; label?: string }>({});
  const [limitError, setLimitError] = useState<ApiClientError>();

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = {
      ...(label.trim() ? {} : { label: t("labelRequired") }),
      ...(areaId ? {} : { area: t("areaRequired") }),
    };
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    mutation.mutate(
      {
        action: () =>
          merchantApi.createFloorTable(tenantId, outletId, {
            areaId,
            capacity,
            label: label.trim(),
            shape,
            visualSize,
          }),
        success: t("tableAdded", { label: label.trim() }),
      },
      {
        onError: (error) => setLimitError(isLimitReached(error) ? error : undefined),
        onSuccess: (created) => onCreated(created as FloorTable),
      },
    );
  }

  return (
    <Sheet
      closeLabel={t("close")}
      footer={
        limitError ? undefined : (
          <Button
            form="new-table-form"
            loading={mutation.isPending}
            loadingLabel={t("saving")}
            type="submit"
          >
            {t("add")}
          </Button>
        )
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      size="sm"
      title={t("newTable")}
    >
      {limitError ? (
        <LimitReachedState error={limitError} />
      ) : (
        <form className="grid gap-4" id="new-table-form" noValidate onSubmit={submit}>
          <FormField
            {...(errors.label ? { error: errors.label } : {})}
            htmlFor={labelId}
            label={t("tableLabel")}
          >
            <Input
              autoFocus
              id={labelId}
              maxLength={20}
              onChange={(event) => setLabel(event.target.value)}
              value={label}
            />
          </FormField>
          <Labeled label={t("capacity")}>
            <QuantityStepper
              decreaseLabel={t("capacityDown")}
              increaseLabel={t("capacityUp")}
              label={t("capacity")}
              max={50}
              min={1}
              onValueChange={setCapacity}
              value={capacity}
            />
          </Labeled>
          <Labeled label={t("shape")}>
            <SegmentedControl
              items={SHAPES.map((item) => ({ label: t(`shapes.${item}`), value: item }))}
              label={t("shape")}
              onValueChange={(value) => setShape(value as FloorTableShape)}
              value={shape}
            />
          </Labeled>
          <Labeled label={t("size")}>
            <SegmentedControl
              items={SIZES.map((item) => ({ label: t(`sizes.${item}`), value: item }))}
              label={t("size")}
              onValueChange={(value) => setVisualSize(value as FloorTableSize)}
              value={visualSize}
            />
          </Labeled>
          <Labeled label={t("area")}>
            <Select
              {...(errors.area ? { error: errors.area } : {})}
              emptyLabel={t("noArea")}
              label={t("area")}
              onValueChange={setAreaId}
              options={areas.map((area) => ({ label: area.name, value: area.id }))}
              placeholder={t("chooseArea")}
              {...(areaId ? { value: areaId } : {})}
            />
          </Labeled>
        </form>
      )}
    </Sheet>
  );
}
