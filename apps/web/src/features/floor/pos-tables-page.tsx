"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  PERMISSIONS,
  type FloorTableStatus,
  type LiveFloor,
  type LiveTable,
  type TableSession,
} from "@merchant/contracts";
import { AreaSelector } from "@merchant/ui/area-selector";
import { Button } from "@merchant/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@merchant/ui/feedback";
import { FloorSelector } from "@merchant/ui/floor-selector";
import { LiveTableView, type LiveTableViewItem } from "@merchant/ui/live-table-view";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { Sheet } from "@merchant/ui/overlay";
import { PageHeader } from "@merchant/ui/page";
import { Select } from "@merchant/ui/select";
import { QuantityStepper } from "@merchant/ui/selection-control";
import { TableSessionPanel } from "@merchant/ui/table-session-panel";
import type { TableTileMetric, TableTileState } from "@merchant/ui/table-tile";

import { useWorkspace } from "@/features/workspace";
import { merchantApi } from "@/lib/api-client";
import { useErrorMessage, useFormat } from "@/lib/i18n";
import { useMediaQuery } from "@/lib/use-media-query";
import { useToast } from "@/providers/toast-provider";
import { RequestErrorState } from "@/shell/request-error-state";

import { useCellSize } from "./use-cell-size";

/** How often the cashier's view of the tables is read again. */
export const LIVE_FLOOR_REFRESH_MS = 10_000;

const STATUSES: readonly FloorTableStatus[] = [
  "AVAILABLE",
  "OCCUPIED",
  "CLOSING",
  "CLEANING",
  "INACTIVE",
];

const TILE_STATE: Record<FloorTableStatus, TableTileState> = {
  AVAILABLE: "available",
  CLEANING: "cleaning",
  CLOSING: "closing",
  INACTIVE: "disabled",
  OCCUPIED: "occupied",
};

const liveKey = (tenantId: string, outletId: string) =>
  ["floor", tenantId, outletId, "live"] as const;

const canvasShape = (shape: LiveTable["shape"]) =>
  shape === "RECTANGLE" ? "rectangle" : shape === "ROUND" ? "round" : "square";

/** Minutes since the guests sat down; the clock is only read when the view renders. */
const minutesSince = (iso: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));

/** POS > Tables: who sits where, seating guests, and letting tables go. */
export function PosTablesPage() {
  const t = useTranslations("floor");
  const { can, outlet, workspace } = useWorkspace();
  if (!can(PERMISSIONS.tableView)) {
    return (
      <ModuleAccessState
        description={t("posAccessDenied")}
        reason="permission-denied"
        title={t("posAccessDeniedTitle")}
      />
    );
  }
  if (!outlet) {
    return <ErrorState description={t("noOutlet")} title={t("posAccessDeniedTitle")} />;
  }
  const tenantId = workspace.tenant.id;
  return (
    <LiveTables
      canSeat={can(PERMISSIONS.tableManage)}
      key={`${tenantId}:${outlet.id}`}
      outletId={outlet.id}
      tenantId={tenantId}
    />
  );
}

function LiveTables({
  canSeat,
  outletId,
  tenantId,
}: Readonly<{ canSeat: boolean; outletId: string; tenantId: string }>) {
  const t = useTranslations("floor");
  const notify = useToast();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const wide = useMediaQuery("(min-width: 1024px)");
  const plan = useMediaQuery("(min-width: 768px)");
  const query = useQuery({
    queryFn: () => merchantApi.liveFloor(tenantId, outletId),
    queryKey: liveKey(tenantId, outletId),
    refetchInterval: LIVE_FLOOR_REFRESH_MS,
  });
  const action = useMutation({
    mutationFn: ({ run }: { run: () => Promise<unknown>; success: string }) => run(),
    onError: (error) => notify({ message: errorMessage(error), tone: "danger" }),
    onSuccess: async (_result, { success }) => {
      await queryClient.invalidateQueries({ queryKey: liveKey(tenantId, outletId) });
      notify({ message: success, tone: "success" });
    },
  });
  const [floorId, setFloorId] = useState<string>();
  const [areaId, setAreaId] = useState<string | null>(null);
  const [status, setStatus] = useState<"ALL" | FloorTableStatus>("ALL");
  const [selectedId, setSelectedId] = useState<string>();
  const { cell, ref: planBox } = useCellSize(
    (query.data?.floors.find((floor) => floor.id === floorId) ?? query.data?.floors[0])?.gridCols ??
      24,
    20,
    48,
  );

  if (query.isPending) {
    return (
      <>
        <PageHeader title={t("posTitle")} />
        <div className="grid gap-2">
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
        </div>
      </>
    );
  }
  if (query.isError) {
    return (
      <>
        <PageHeader title={t("posTitle")} />
        <RequestErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          title={t("loadFailed")}
        />
      </>
    );
  }

  const live: LiveFloor = query.data;
  const floor = live.floors.find((item) => item.id === floorId) ?? live.floors[0];
  const areaIds = new Set(floor?.areas.map((area) => area.id) ?? []);
  const sessions = new Map(live.sessions.map((session) => [session.id, session]));
  // Durations count to the moment the view was last read, so they move with each refresh.
  const now = query.dataUpdatedAt;
  const onFloor = live.tables.filter((table) => areaIds.has(table.areaId));
  const shown = onFloor.filter(
    (table) =>
      (areaId === null || table.areaId === areaId) && (status === "ALL" || table.status === status),
  );
  const selected = live.tables.find((table) => table.id === selectedId);
  const selectedSession = selected?.sessionId ? sessions.get(selected.sessionId) : undefined;
  // A visit is named by its table and number; a free or cleaning table by its label.
  const panelTitle = (table: LiveTable) => {
    const session = table.sessionId ? sessions.get(table.sessionId) : undefined;
    return session && table.status !== "CLEANING"
      ? t("visitTitle", { label: table.label, number: session.displayNumber })
      : t("tableTitle", { label: table.label });
  };

  const metrics = (session: TableSession | undefined): TableTileMetric[] => {
    if (!session) return [];
    const minutes = minutesSince(session.openedAt, now);
    return [
      {
        kind: "guests",
        label: t("guestsMetric", { count: session.guestCount }),
        text: String(session.guestCount),
      },
      {
        kind: "duration",
        label: t("durationLabel", { minutes }),
        text: t("durationShort", { minutes }),
      },
    ];
  };

  const items: LiveTableViewItem[] = shown.map((table) => ({
    capacity: table.capacity,
    ...(table.status === "INACTIVE" ? { disabled: true } : {}),
    gridH: table.gridH,
    gridW: table.gridW,
    gridX: table.gridX,
    gridY: table.gridY,
    id: table.id,
    label: table.label,
    metrics: metrics(table.sessionId ? sessions.get(table.sessionId) : undefined),
    shape: canvasShape(table.shape),
    state: TILE_STATE[table.status],
    stateLabel: t(`tableStatus.${table.status}`),
  }));

  const panel = selected ? (
    <TablePanel
      busy={action.isPending}
      canSeat={canSeat}
      key={`${selected.id}:${selected.sessionId ?? ""}`}
      now={now}
      onClean={() =>
        action.mutate(
          {
            run: () => merchantApi.cleanTable(tenantId, outletId, selected.id),
            success: t("tableCleaned", { label: selected.label }),
          },
          { onSuccess: () => setSelectedId(undefined) },
        )
      }
      onClose={(session) =>
        action.mutate(
          {
            run: () => merchantApi.closeTableSession(tenantId, outletId, session.id),
            success: t("visitClosed", { label: selected.label }),
          },
          { onSuccess: () => setSelectedId(undefined) },
        )
      }
      onOpen={(guestCount) =>
        action.mutate({
          run: () =>
            merchantApi.openTableSession(tenantId, outletId, { guestCount, tableId: selected.id }),
          success: t("tableOpened", { count: guestCount, label: selected.label }),
        })
      }
      session={selectedSession}
      table={selected}
      title={panelTitle(selected)}
      titleHidden={!wide}
    />
  ) : null;

  return (
    <>
      <PageHeader title={t("posTitle")} />
      {floor ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <FloorSelector
              activeId={floor.id}
              floors={live.floors.map((item) => ({ id: item.id, label: item.name }))}
              labels={{
                empty: t("noFloor"),
                placeholder: t("chooseFloor"),
                selector: t("chooseFloor"),
              }}
              onValueChange={(id) => {
                setFloorId(id);
                setAreaId(null);
                setSelectedId(undefined);
              }}
            />
            <div className="ms-auto w-full sm:w-56">
              <Select
                emptyLabel={t("allStatuses")}
                label={t("statusFilter")}
                onValueChange={(value) => setStatus(value as "ALL" | FloorTableStatus)}
                options={[
                  { label: t("allStatuses"), value: "ALL" },
                  ...STATUSES.map((item) => ({ label: t(`tableStatus.${item}`), value: item })),
                ]}
                placeholder={t("allStatuses")}
                value={status}
              />
            </div>
          </div>
          <AreaSelector
            activeId={areaId}
            areas={floor.areas.map((area) => ({ id: area.id, label: area.name }))}
            labels={{ all: t("allAreas"), selector: t("chooseArea") }}
            onValueChange={(id) => {
              setAreaId(id);
              setSelectedId(undefined);
            }}
          />
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 overflow-auto" ref={planBox}>
              {onFloor.length === 0 ? (
                <EmptyState description={t("noTablesHint")} title={t("noTables")} />
              ) : items.length === 0 ? (
                <EmptyState description={t("noMatchHint")} title={t("noMatch")} />
              ) : (
                <LiveTableView
                  cellSize={cell}
                  columns={floor.gridCols}
                  items={items}
                  labels={{
                    canvas: t("canvas", { floor: floor.name }),
                    list: t("listName", { floor: floor.name }),
                    moveDown: t("moveDown"),
                    moveGroup: t("moveGroup"),
                    moveLeft: t("moveLeft"),
                    moveRight: t("moveRight"),
                    moveUp: t("moveUp"),
                    overlap: (first, second) => t("overlap", { first, second }),
                    position: (label) => label,
                    validationTitle: t("overlapTitle"),
                  }}
                  layout={plan ? "plan" : "list"}
                  onSelectItem={setSelectedId}
                  rows={floor.gridRows}
                  {...(selectedId ? { selectedId } : {})}
                />
              )}
            </div>
            {wide && panel ? (
              <aside className="rounded-md border border-line-default p-4">{panel}</aside>
            ) : null}
          </div>
        </div>
      ) : (
        <EmptyState description={t("noFloorHint")} title={t("noFloor")} />
      )}
      {!wide && selected ? (
        <Sheet
          closeLabel={t("close")}
          onOpenChange={(open) => {
            if (!open) setSelectedId(undefined);
          }}
          open
          size="sm"
          title={panelTitle(selected)}
        >
          {panel}
        </Sheet>
      ) : null}
    </>
  );
}

/** What a table offers right now: seat guests, see the visit, let the table go. */
function TablePanel({
  busy,
  canSeat,
  now,
  onClean,
  onClose,
  onOpen,
  session,
  table,
  title,
  titleHidden,
}: Readonly<{
  busy: boolean;
  canSeat: boolean;
  now: number;
  onClean: () => void;
  onClose: (session: TableSession) => void;
  onOpen: (guestCount: number) => void;
  session: TableSession | undefined;
  table: LiveTable;
  title: string;
  /** In a sheet the sheet already names the table. */
  titleHidden: boolean;
}>) {
  const t = useTranslations("floor");
  const { time } = useFormat();
  const [guests, setGuests] = useState(Math.min(table.capacity, 2));
  const statusText = t(`tableStatus.${table.status}`);

  if (session && table.status !== "CLEANING") {
    const minutes = minutesSince(session.openedAt, now);
    return (
      <TableSessionPanel
        actions={
          canSeat ? (
            <Button disabled={busy} onClick={() => onClose(session)} variant="secondary">
              {t("closeVisit")}
            </Button>
          ) : undefined
        }
        facts={[
          { label: t("guests"), value: session.guestCount },
          { label: t("seatedSince"), value: time(session.openedAt) },
          { label: t("seatedFor"), value: t("durationLabel", { minutes }) },
        ]}
        status={statusText}
        title={title}
        titleHidden={titleHidden}
      />
    );
  }

  if (table.status === "CLEANING") {
    return (
      <TableSessionPanel
        actions={
          canSeat ? (
            <Button disabled={busy} onClick={onClean}>
              {t("markClean")}
            </Button>
          ) : undefined
        }
        facts={[{ label: t("capacity"), value: table.capacity }]}
        status={statusText}
        title={title}
        titleHidden={titleHidden}
      />
    );
  }

  return (
    <TableSessionPanel
      actions={
        canSeat && table.status === "AVAILABLE" ? (
          <Button loading={busy} loadingLabel={t("saving")} onClick={() => onOpen(guests)}>
            {t("openTable")}
          </Button>
        ) : undefined
      }
      facts={[{ label: t("capacity"), value: table.capacity }]}
      status={statusText}
      title={title}
      titleHidden={titleHidden}
    >
      {canSeat && table.status === "AVAILABLE" ? (
        <QuantityStepper
          decreaseLabel={t("guestsDown")}
          increaseLabel={t("guestsUp")}
          label={t("guests")}
          max={99}
          min={1}
          onValueChange={setGuests}
          value={guests}
        />
      ) : null}
    </TableSessionPanel>
  );
}
