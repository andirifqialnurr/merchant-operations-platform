"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { IconPlus, IconStack2 } from "@tabler/icons-react";

import { PERMISSIONS, type Floor, type FloorTable } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { ErrorState, Skeleton } from "@merchant/ui/feedback";
import { FloorSelector } from "@merchant/ui/floor-selector";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { Sheet } from "@merchant/ui/overlay";
import { PageHeader } from "@merchant/ui/page";
import {
  getTableLayoutOverlapIssues,
  TableLayoutCanvas,
  type TableLayoutCanvasItem,
} from "@merchant/ui/table-layout-canvas";
import { UnplacedTableTray } from "@merchant/ui/table-layout-tray";

import { useWorkspace } from "@/features/workspace";
import { merchantApi } from "@/lib/api-client";
import { useMediaQuery } from "@/lib/use-media-query";
import { useToast } from "@/providers/toast-provider";
import { RequestErrorState } from "@/shell/request-error-state";

import { useFloorMutation, useFloors, useFloorTables } from "./api";
import {
  edited,
  firstFreeSpot,
  type LayoutDraft,
  type TableEdit,
  toLayout,
  withDraft,
} from "./layout-draft";
import { NewTableSheet } from "./new-table-sheet";
import { StructureSheet } from "./structure-sheet";
import { TableForm } from "./table-form";
import { useCellSize } from "@/lib/use-cell-size";

/** Smallest and largest size of one grid cell on screen, in pixels. */
const CELL_MIN = 20;
const CELL_MAX = 44;

/** Tables: lay out the floors of the current outlet. */
export function FloorPage() {
  const t = useTranslations("floor");
  const { can, outlet, workspace } = useWorkspace();

  if (!can(PERMISSIONS.tableLayoutManage)) {
    return (
      <ModuleAccessState
        description={t("accessDenied")}
        reason="permission-denied"
        title={t("accessDeniedTitle")}
      />
    );
  }
  if (!outlet) {
    return <ErrorState description={t("noOutlet")} title={t("accessDeniedTitle")} />;
  }
  const tenantId = workspace.tenant.id;
  return <OutletFloors key={`${tenantId}:${outlet.id}`} outletId={outlet.id} tenantId={tenantId} />;
}

const canvasShape = (shape: FloorTable["shape"]) =>
  shape === "RECTANGLE" ? "rectangle" : shape === "ROUND" ? "round" : "square";

function OutletFloors({ outletId, tenantId }: Readonly<{ outletId: string; tenantId: string }>) {
  const t = useTranslations("floor");
  const notify = useToast();
  const wide = useMediaQuery("(min-width: 1280px)");
  const floorsQuery = useFloors(tenantId, outletId, true);
  const tablesQuery = useFloorTables(tenantId, outletId);
  const mutation = useFloorMutation(tenantId, outletId);
  const [chosen, setChosen] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<LayoutDraft>(new Map());
  const [sheet, setSheet] = useState<"new-table" | "structure">();

  const floors = useMemo(() => floorsQuery.data?.floors ?? [], [floorsQuery.data]);
  const active = floors.filter((floor) => floor.status === "ACTIVE");
  const current = active.find((floor) => floor.id === chosen) ?? active[0];
  const grid = { cols: current?.gridCols ?? 24, rows: current?.gridRows ?? 16 };
  const { cell, ref: canvasBox } = useCellSize(grid.cols, CELL_MIN, CELL_MAX);

  const floorOfArea = useMemo(
    () => new Map(floors.flatMap((floor) => floor.areas.map((area) => [area.id, floor.id]))),
    [floors],
  );
  const saved = tablesQuery.data?.tables ?? [];
  const shown = saved.map((table) => withDraft(table, draft));
  const onFloor = (floor: Floor | undefined) =>
    shown.filter((table) => floor !== undefined && floorOfArea.get(table.areaId) === floor.id);
  const floorTables = onFloor(current);
  const placed = floorTables.filter((table) => table.gridX !== null && table.gridY !== null);
  const waiting = floorTables.filter((table) => table.gridX === null || table.gridY === null);
  const selected = floorTables.find((table) => table.id === selectedId);
  const dirty = draft.size > 0;

  const canvasItems: TableLayoutCanvasItem[] = placed.map((table) => ({
    capacity: table.capacity,
    gridH: table.gridH,
    gridW: table.gridW,
    gridX: table.gridX ?? 0,
    gridY: table.gridY ?? 0,
    id: table.id,
    label: table.label.trim() || "?",
    shape: canvasShape(table.shape),
    ...(table.status === "INACTIVE"
      ? { state: "disabled" as const, stateLabel: t("inactive") }
      : { state: "available" as const }),
  }));
  const overlapping = getTableLayoutOverlapIssues(canvasItems).length > 0;
  const blankLabel = shown.some((table) => !table.label.trim());

  // Leaving the page would lose the unsaved layout.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(id: string, edit: TableEdit) {
    const table = saved.find((item) => item.id === id);
    if (table) setDraft((value) => edited(value, table, edit, grid));
  }

  function place(id: string) {
    const table = floorTables.find((item) => item.id === id);
    if (!table) return;
    const spot = firstFreeSpot(table, floorTables, grid);
    if (!spot) {
      notify({ message: t("noRoom"), tone: "danger" });
      return;
    }
    change(id, spot);
    setSelectedId(id);
  }

  function save() {
    const byFloor = new Map<string, FloorTable[]>();
    for (const table of shown) {
      if (!draft.has(table.id)) continue;
      const floorId = floorOfArea.get(table.areaId);
      if (floorId) byFloor.set(floorId, [...(byFloor.get(floorId) ?? []), table]);
    }
    mutation.mutate(
      {
        action: async () => {
          for (const [floorId, tables] of byFloor) {
            await merchantApi.saveFloorLayout(tenantId, outletId, floorId, tables.map(toLayout));
          }
        },
        success: t("layoutSaved"),
      },
      { onSuccess: () => setDraft(new Map()) },
    );
  }

  const form =
    selected && current ? (
      <TableForm
        areas={current.areas.filter(
          (area) => area.status === "ACTIVE" || area.id === selected.areaId,
        )}
        grid={grid}
        onChange={(edit) => change(selected.id, edit)}
        onPlace={() => place(selected.id)}
        table={selected}
      />
    ) : null;

  const tray = (
    <UnplacedTableTray
      items={waiting.map((table) => ({ id: table.id, label: table.label.trim() || "?" }))}
      labels={{
        count: (count) => t("tableCount", { count }),
        empty: t("trayEmpty"),
        place: (label) => t("placeTable", { label }),
        title: t("trayTitle"),
      }}
      onPlaceItem={place}
      {...(selectedId ? { selectedId } : {})}
    />
  );

  const loading = floorsQuery.isPending || tablesQuery.isPending;
  const failed = floorsQuery.isError
    ? floorsQuery.error
    : tablesQuery.isError
      ? tablesQuery.error
      : null;

  return (
    <>
      <PageHeader
        primaryAction={
          <Button
            disabled={!current}
            iconLeft={IconPlus}
            onClick={() => setSheet("new-table")}
            variant={dirty ? "secondary" : "primary"}
          >
            {t("addTable")}
          </Button>
        }
        secondaryActions={
          <Button
            disabled={!floorsQuery.data || dirty}
            iconLeft={IconStack2}
            onClick={() => setSheet("structure")}
            variant="secondary"
          >
            {t("structureTitle")}
          </Button>
        }
        title={t("title")}
      />
      {loading ? (
        <div className="grid gap-2">
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
        </div>
      ) : failed ? (
        <RequestErrorState
          error={failed}
          onRetry={() => {
            void floorsQuery.refetch();
            void tablesQuery.refetch();
          }}
          title={t("loadFailed")}
        />
      ) : current ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FloorSelector
              activeId={current.id}
              floors={active.map((floor) => ({
                id: floor.id,
                label: floor.name,
                tableCount: onFloor(floor).filter((table) => table.status === "ACTIVE").length,
              }))}
              labels={{
                empty: t("noFloor"),
                placeholder: t("chooseFloor"),
                selector: t("chooseFloor"),
                tableCount: (count) => t("tableCount", { count }),
              }}
              onValueChange={(id) => {
                setChosen(id);
                setSelectedId(undefined);
              }}
            />
            {dirty ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-label text-foreground-secondary" role="status">
                  {t("unsaved", { count: draft.size })}
                </span>
                <Button
                  disabled={mutation.isPending}
                  onClick={() => setDraft(new Map())}
                  variant="ghost"
                >
                  {t("discard")}
                </Button>
                <Button
                  disabled={overlapping || blankLabel}
                  loading={mutation.isPending}
                  loadingLabel={t("saving")}
                  onClick={save}
                >
                  {t("saveLayout")}
                </Button>
              </div>
            ) : null}
          </div>
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 overflow-auto" ref={canvasBox}>
              <TableLayoutCanvas
                cellSize={cell}
                columns={grid.cols}
                items={canvasItems}
                labels={{
                  canvas: t("canvas", { floor: current.name }),
                  moveDown: t("moveDown"),
                  moveGroup: t("moveGroup"),
                  moveLeft: t("moveLeft"),
                  moveRight: t("moveRight"),
                  moveUp: t("moveUp"),
                  overlap: (first, second) => t("overlap", { first, second }),
                  position: (label, column, row, overlaps) =>
                    overlaps
                      ? t("positionOverlapping", { column, label, row })
                      : t("position", { column, label, row }),
                  validationTitle: t("overlapTitle"),
                }}
                mode="edit"
                onItemMove={(id, position) =>
                  change(id, { gridX: position.gridX, gridY: position.gridY })
                }
                onSelectItem={setSelectedId}
                rows={grid.rows}
                {...(selectedId ? { selectedId } : {})}
                variant="fit"
              />
            </div>
            {wide ? (
              <aside className="grid gap-4">
                {selected ? (
                  <section
                    aria-label={t("tableTitle", { label: selected.label })}
                    className="grid gap-4 rounded-md border border-line-default p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="m-0 text-heading-sm">
                        {t("tableTitle", { label: selected.label })}
                      </h2>
                      <Button onClick={() => setSelectedId(undefined)} size="sm" variant="ghost">
                        {t("done")}
                      </Button>
                    </div>
                    {form}
                  </section>
                ) : null}
                {tray}
              </aside>
            ) : (
              tray
            )}
          </div>
        </div>
      ) : null}
      {!wide && selected ? (
        <Sheet
          closeLabel={t("close")}
          onOpenChange={(open) => {
            if (!open) setSelectedId(undefined);
          }}
          open
          size="sm"
          title={t("tableTitle", { label: selected.label })}
        >
          {form}
        </Sheet>
      ) : null}
      {sheet === "structure" && floorsQuery.data ? (
        <StructureSheet
          floors={floors}
          mutation={mutation}
          onClose={() => setSheet(undefined)}
          outletId={outletId}
          tenantId={tenantId}
        />
      ) : null}
      {sheet === "new-table" && current ? (
        <NewTableSheet
          areas={current.areas.filter((area) => area.status === "ACTIVE")}
          mutation={mutation}
          onClose={() => setSheet(undefined)}
          onCreated={(table) => {
            setSheet(undefined);
            setSelectedId(table.id);
          }}
          outletId={outletId}
          tenantId={tenantId}
        />
      ) : null}
    </>
  );
}
