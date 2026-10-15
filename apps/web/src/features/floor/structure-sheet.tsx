"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { IconArrowDown, IconArrowUp, IconPencil, IconPlus } from "@tabler/icons-react";

import type { Floor, FloorArea, FloorRecordStatus } from "@merchant/contracts";
import { Button, IconButton } from "@merchant/ui/button";
import { Badge } from "@merchant/ui/feedback";
import { FormField, Input } from "@merchant/ui/form-field";
import { Sheet } from "@merchant/ui/overlay";
import { Switch } from "@merchant/ui/selection-control";

import { type ApiClientError, merchantApi } from "@/lib/api-client";
import { isLimitReached, LimitReachedState } from "@/shell/limit-reached-state";

import { type FloorMutation, useFloorPolicy } from "./api";

type Target =
  | { floorId: string; kind: "new-area" }
  | { id: string; kind: "area" | "floor" }
  | { kind: "new-floor" };

const sameTarget = (left: Target | undefined, right: Target) =>
  JSON.stringify(left) === JSON.stringify(right);

/** Moves one id a step up or down in a list of ids. */
function moved(ids: readonly string[], id: string, step: -1 | 1) {
  const index = ids.indexOf(id);
  const next = [...ids];
  [next[index], next[index + step]] = [next[index + step]!, next[index]!];
  return next;
}

/** A name typed in place, for adding or renaming. */
function NameForm({
  initial = "",
  label,
  onCancel,
  onSubmit,
  pending,
  status,
  submitLabel,
  onToggleStatus,
}: Readonly<{
  initial?: string;
  label: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
  onToggleStatus?: () => void;
  pending: boolean;
  status?: FloorRecordStatus;
  submitLabel: string;
}>) {
  const t = useTranslations("floor");
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string>();
  const id = useId();
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    onSubmit(name.trim());
  }
  return (
    <form className="grid gap-2 py-2" noValidate onSubmit={submit}>
      <FormField {...(error ? { error } : {})} htmlFor={id} label={label}>
        <Input
          autoFocus
          id={id}
          maxLength={80}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
          onKeyDown={(event) => {
            // Leaves the name, not the whole sheet.
            if (event.key === "Escape") {
              event.stopPropagation();
              onCancel();
            }
          }}
          value={name}
        />
      </FormField>
      <div className="flex flex-wrap items-center gap-2">
        <Button loading={pending} loadingLabel={t("saving")} size="sm" type="submit">
          {submitLabel}
        </Button>
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          {t("cancel")}
        </Button>
        {onToggleStatus && status ? (
          <Button
            className="ms-auto"
            disabled={pending}
            onClick={onToggleStatus}
            size="sm"
            type="button"
            variant="secondary"
          >
            {status === "ACTIVE" ? t("deactivate") : t("activate")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** One floor or area: its name, its place in the order, and a way to change it. */
function ItemRow({
  canDown,
  canUp,
  editLabel,
  name,
  nested,
  onDown,
  onEdit,
  onUp,
  pending,
  status,
}: Readonly<{
  canDown: boolean;
  canUp: boolean;
  editLabel: string;
  name: string;
  nested?: boolean;
  onDown: () => void;
  onEdit: () => void;
  onUp: () => void;
  pending: boolean;
  status: FloorRecordStatus;
}>) {
  const t = useTranslations("floor");
  return (
    <div className={`flex min-h-11 items-center gap-2 ${nested ? "ps-4" : ""}`}>
      <span
        className={`min-w-0 flex-1 truncate ${nested ? "text-body" : "text-body font-semibold"}`}
      >
        {name}
      </span>
      {status === "INACTIVE" ? <Badge tone="neutral">{t("inactive")}</Badge> : null}
      <IconButton
        disabled={!canUp || pending}
        icon={IconArrowUp}
        label={t("moveUp", { name })}
        onClick={onUp}
        size="sm"
      />
      <IconButton
        disabled={!canDown || pending}
        icon={IconArrowDown}
        label={t("moveDown", { name })}
        onClick={onDown}
        size="sm"
      />
      <IconButton icon={IconPencil} label={editLabel} onClick={onEdit} size="sm" />
    </div>
  );
}

/** Floors > Floors and areas: add, rename, order, and set aside. */
export function StructureSheet({
  floors,
  mutation,
  onClose,
  outletId,
  tenantId,
}: Readonly<{
  floors: readonly Floor[];
  mutation: FloorMutation;
  onClose: () => void;
  outletId: string;
  tenantId: string;
}>) {
  const t = useTranslations("floor");
  const [target, setTarget] = useState<Target>();
  const [limitError, setLimitError] = useState<ApiClientError>();
  const pending = mutation.isPending;
  const policy = useFloorPolicy(tenantId, outletId);

  function run(action: () => Promise<unknown>, success?: string) {
    setLimitError(undefined);
    mutation.mutate(
      { action, ...(success ? { success } : {}) },
      {
        onError: (error) => {
          if (isLimitReached(error)) setLimitError(error);
        },
        onSuccess: () => setTarget(undefined),
      },
    );
  }

  const floorIds = floors.map((floor) => floor.id);

  function areaRows(floor: Floor) {
    const areaIds = floor.areas.map((area) => area.id);
    return floor.areas.map((area: FloorArea, index) =>
      sameTarget(target, { id: area.id, kind: "area" }) ? (
        <div className="ps-4" key={area.id}>
          <NameForm
            initial={area.name}
            label={t("areaName")}
            onCancel={() => setTarget(undefined)}
            onSubmit={(name) =>
              run(
                () => merchantApi.updateFloorArea(tenantId, outletId, area.id, { name }),
                t("saved"),
              )
            }
            onToggleStatus={() =>
              run(
                () =>
                  merchantApi.updateFloorArea(tenantId, outletId, area.id, {
                    status: area.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                  }),
                area.status === "ACTIVE" ? t("areaDeactivated") : t("areaActivated"),
              )
            }
            pending={pending}
            status={area.status}
            submitLabel={t("save")}
          />
        </div>
      ) : (
        <ItemRow
          canDown={index < floor.areas.length - 1}
          canUp={index > 0}
          editLabel={t("editArea", { name: area.name })}
          key={area.id}
          name={area.name}
          nested
          onDown={() =>
            run(() =>
              merchantApi.reorderFloorAreas(
                tenantId,
                outletId,
                floor.id,
                moved(areaIds, area.id, 1),
              ),
            )
          }
          onEdit={() => setTarget({ id: area.id, kind: "area" })}
          onUp={() =>
            run(() =>
              merchantApi.reorderFloorAreas(
                tenantId,
                outletId,
                floor.id,
                moved(areaIds, area.id, -1),
              ),
            )
          }
          pending={pending}
          status={area.status}
        />
      ),
    );
  }

  return (
    <Sheet
      closeLabel={t("close")}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      size="md"
      title={t("structureTitle")}
    >
      <div className="grid gap-4">
        {limitError ? <LimitReachedState error={limitError} /> : null}
        {policy.data ? (
          <div className="border-b border-line-default pb-3">
            <Switch
              checked={policy.data.cleaningAfterClose}
              disabled={pending}
              label={t("cleaningAfterClose")}
              onChange={(event) =>
                run(
                  () =>
                    merchantApi.setFloorPolicy(tenantId, outletId, {
                      cleaningAfterClose: event.target.checked,
                    }),
                  t("policySaved"),
                )
              }
            />
          </div>
        ) : null}
        {floors.map((floor, index) => (
          <section
            aria-label={floor.name}
            className="grid border-b border-line-default pb-3"
            key={floor.id}
          >
            {sameTarget(target, { id: floor.id, kind: "floor" }) ? (
              <NameForm
                initial={floor.name}
                label={t("floorName")}
                onCancel={() => setTarget(undefined)}
                onSubmit={(name) =>
                  run(
                    () => merchantApi.updateFloor(tenantId, outletId, floor.id, { name }),
                    t("saved"),
                  )
                }
                onToggleStatus={() =>
                  run(
                    () =>
                      merchantApi.updateFloor(tenantId, outletId, floor.id, {
                        status: floor.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                      }),
                    floor.status === "ACTIVE" ? t("floorDeactivated") : t("floorActivated"),
                  )
                }
                pending={pending}
                status={floor.status}
                submitLabel={t("save")}
              />
            ) : (
              <ItemRow
                canDown={index < floors.length - 1}
                canUp={index > 0}
                editLabel={t("editFloor", { name: floor.name })}
                name={floor.name}
                onDown={() =>
                  run(() =>
                    merchantApi.reorderFloors(tenantId, outletId, moved(floorIds, floor.id, 1)),
                  )
                }
                onEdit={() => setTarget({ id: floor.id, kind: "floor" })}
                onUp={() =>
                  run(() =>
                    merchantApi.reorderFloors(tenantId, outletId, moved(floorIds, floor.id, -1)),
                  )
                }
                pending={pending}
                status={floor.status}
              />
            )}
            {areaRows(floor)}
            <div className="ps-4">
              {sameTarget(target, { floorId: floor.id, kind: "new-area" }) ? (
                <NameForm
                  label={t("areaName")}
                  onCancel={() => setTarget(undefined)}
                  onSubmit={(name) =>
                    run(
                      () => merchantApi.createFloorArea(tenantId, outletId, floor.id, { name }),
                      t("areaAdded"),
                    )
                  }
                  pending={pending}
                  submitLabel={t("add")}
                />
              ) : (
                <Button
                  iconLeft={IconPlus}
                  onClick={() => setTarget({ floorId: floor.id, kind: "new-area" })}
                  size="sm"
                  variant="ghost"
                >
                  {t("addArea")}
                </Button>
              )}
            </div>
          </section>
        ))}
        {sameTarget(target, { kind: "new-floor" }) ? (
          <NameForm
            label={t("floorName")}
            onCancel={() => setTarget(undefined)}
            onSubmit={(name) =>
              run(() => merchantApi.createFloor(tenantId, outletId, { name }), t("floorAdded"))
            }
            pending={pending}
            submitLabel={t("add")}
          />
        ) : (
          <div>
            <Button
              iconLeft={IconPlus}
              onClick={() => setTarget({ kind: "new-floor" })}
              size="sm"
              variant="secondary"
            >
              {t("addFloor")}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
