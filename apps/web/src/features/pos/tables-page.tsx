"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { IconLock } from "@tabler/icons-react";

import {
  PERMISSIONS,
  type FloorTableStatus,
  type LiveFloor,
  type LiveTable,
  type PaymentClaim,
  type TableSession,
  type TableSessionCheckout,
  type TableSessionDetail,
} from "@merchant/contracts";
import { AppIcon } from "@merchant/ui/app-icon";
import { AreaSelector } from "@merchant/ui/area-selector";
import { Button } from "@merchant/ui/button";
import { Alert, EmptyState, ErrorState, Skeleton } from "@merchant/ui/feedback";
import { FloorSelector } from "@merchant/ui/floor-selector";
import { LiveTableView, type LiveTableViewItem } from "@merchant/ui/live-table-view";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { MoneyDisplay } from "@merchant/ui/money-display";
import { DropdownMenu, Sheet } from "@merchant/ui/overlay";
import { PageHeader } from "@merchant/ui/page";
import { Select } from "@merchant/ui/select";
import { QuantityStepper } from "@merchant/ui/selection-control";
import { TableSessionPanel } from "@merchant/ui/table-session-panel";
import type { TableTileMetric, TableTileState } from "@merchant/ui/table-tile";

import { useWorkspace } from "@/features/workspace";
import { merchantApi } from "@/lib/api-client";
import { useErrorMessage, useFormat } from "@/lib/i18n";
import { useCellSize } from "@/lib/use-cell-size";
import { useMediaQuery } from "@/lib/use-media-query";
import { useToast } from "@/providers/toast-provider";
import { RequestErrorState } from "@/shell/request-error-state";

import { PaymentView } from "./payment-view";
import { VisitDocumentSheet } from "./visit-document-sheet";
import { VisitOrders } from "./visit-orders";
import { visitHasPending } from "./table-order-state";
import { useGuestOrderDecision } from "./use-guest-order-decision";

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
const visitKey = (tenantId: string, outletId: string, sessionId: string) =>
  ["floor", tenantId, outletId, "visit", sessionId] as const;

const canvasShape = (shape: LiveTable["shape"]) =>
  shape === "RECTANGLE" ? "rectangle" : shape === "ROUND" ? "round" : "square";

/** Minutes since the guests sat down, counted to the moment the view was read. */
const minutesSince = (iso: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));

type Permissions = {
  canMove: boolean;
  canOrder: boolean;
  canPay: boolean;
  canSeat: boolean;
  canRejectOrder: boolean;
};

/** POS > Tables: who sits where, seating guests, their orders and bill, and letting tables go. */
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
      allowed={{
        canMove: can(PERMISSIONS.orderMoveTable),
        canOrder: can(PERMISSIONS.orderCreate),
        canPay: can(PERMISSIONS.paymentConfirm),
        canSeat: can(PERMISSIONS.tableManage),
        canRejectOrder: can(PERMISSIONS.orderCancel),
      }}
      key={`${tenantId}:${outlet.id}`}
      outletId={outlet.id}
      tenantId={tenantId}
    />
  );
}

function LiveTables({
  allowed,
  outletId,
  tenantId,
}: Readonly<{ allowed: Permissions; outletId: string; tenantId: string }>) {
  const t = useTranslations("floor");
  const notify = useToast();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const wide = useMediaQuery("(min-width: 1024px)");
  const plan = useMediaQuery("(min-width: 768px)");
  const query = useQuery({
    queryFn: () => merchantApi.liveFloor(tenantId, outletId),
    queryKey: liveKey(tenantId, outletId),
    refetchInterval: LIVE_FLOOR_REFRESH_MS,
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["floor", tenantId, outletId] as const });
  const action = useMutation({
    mutationFn: ({ run }: { run: () => Promise<unknown>; success: string }) => run(),
    onError: (error) => {
      notify({ message: errorMessage(error), tone: "danger" });
      void refresh();
    },
    onSuccess: async (_result, { success }) => {
      await refresh();
      notify({ message: success, tone: "success" });
    },
  });
  // The guests' transfer arrived: their claim becomes the visit's payment.
  const confirm = useMutation({
    mutationFn: ({ claim, sessionId }: { claim: PaymentClaim; label: string; sessionId: string }) =>
      merchantApi.confirmPaymentClaim(tenantId, outletId, sessionId, claim.id, crypto.randomUUID()),
    onError: (error) => {
      notify({ message: errorMessage(error), tone: "danger" });
      void refresh();
    },
    onSuccess: (checkout, { sessionId }) => setPaid({ checkout, sessionId }),
  });
  const { money } = useFormat();
  const [floorId, setFloorId] = useState<string>();
  const [areaId, setAreaId] = useState<string | null>(null);
  const [status, setStatus] = useState<"ALL" | FloorTableStatus>("ALL");
  // Coming back from the sell screen, the table the order was for is open again.
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => params.get("table") ?? undefined,
  );
  const [paying, setPaying] = useState<{ dueMinor: string; sessionId: string }>();
  const [paid, setPaid] = useState<{ checkout: TableSessionCheckout; sessionId: string }>();
  const [documentId, setDocumentId] = useState<string>();
  const [restoreDocumentFocus, setRestoreDocumentFocus] = useState(false);
  const documentSheet = documentId ? (
    <VisitDocumentSheet
      tenantId={tenantId}
      outletId={outletId}
      sessionId={documentId}
      onClose={() => {
        setRestoreDocumentFocus(true);
        setDocumentId(undefined);
      }}
    />
  ) : null;
  const { cell, ref: planBox } = useCellSize(
    (query.data?.floors.find((floor) => floor.id === floorId) ?? query.data?.floors[0])?.gridCols ??
      24,
    20,
    48,
  );

  if (paid) {
    return (
      <>
        <VisitPaid
          checkout={paid.checkout}
          onDocument={allowed.canOrder ? () => setDocumentId(paid.sessionId) : undefined}
          onDone={() => {
            setPaid(undefined);
            void refresh();
          }}
        />
        {documentSheet}
      </>
    );
  }
  if (paying) {
    return (
      <PaymentView
        onBack={() => setPaying(undefined)}
        onSessionPaid={(checkout) => {
          setPaying(undefined);
          setPaid({ checkout, sessionId: paying.sessionId });
        }}
        outletId={outletId}
        source={{ dueMinor: paying.dueMinor, kind: "session", sessionId: paying.sessionId }}
        tenantId={tenantId}
      />
    );
  }

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
  const selected = live.tables.find((table) => table.id === selectedId);
  const floor =
    live.floors.find((item) => item.id === floorId) ??
    live.floors.find((item) => item.areas.some((area) => area.id === selected?.areaId)) ??
    live.floors[0];
  const areaIds = new Set(floor?.areas.map((area) => area.id) ?? []);
  const sessions = new Map(live.sessions.map((session) => [session.id, session]));
  // Durations count to the moment the view was last read, so they move with each refresh.
  const now = query.dataUpdatedAt;
  const onFloor = live.tables.filter((table) => areaIds.has(table.areaId));
  const shown = onFloor.filter(
    (table) =>
      (areaId === null || table.areaId === areaId) && (status === "ALL" || table.status === status),
  );
  const selectedSession = selected?.sessionId ? sessions.get(selected.sessionId) : undefined;
  const floorRank = (tableAreaId: string) => {
    const index = live.floors.findIndex((item) =>
      item.areas.some((area) => area.id === tableAreaId),
    );
    return live.floors[index]?.id === floor?.id ? -1 : index;
  };
  // A visit is named by its table and number; a free or cleaning table by its label.
  const panelTitle = (table: LiveTable) => {
    const session = table.sessionId ? sessions.get(table.sessionId) : undefined;
    return session && table.status !== "CLEANING"
      ? t("visitTitle", { label: table.label, number: session.displayNumber })
      : t("tableTitle", { label: table.label });
  };

  const metrics = (
    session: TableSession | undefined,
    pendingOrderCount: number,
  ): TableTileMetric[] => {
    if (!session) return [];
    if (pendingOrderCount > 0)
      return [
        {
          kind: "orders",
          label: t("pendingOrderCount", { count: pendingOrderCount }),
          text: String(pendingOrderCount),
        },
      ];
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
    metrics: metrics(
      table.sessionId ? sessions.get(table.sessionId) : undefined,
      table.pendingOrderCount,
    ),
    shape: canvasShape(table.shape),
    state: table.pendingOrderCount > 0 ? "waiting-order" : TILE_STATE[table.status],
    stateLabel: table.pendingOrderCount > 0 ? t("pendingTile") : t(`tableStatus.${table.status}`),
  }));

  const panel = selected ? (
    selectedSession && selected.status !== "CLEANING" ? (
      <VisitPanel
        allowed={allowed}
        busy={action.isPending || confirm.isPending}
        key={`${selectedSession.id}:${selected.id}`}
        now={now}
        onClose={() =>
          action.mutate(
            {
              run: () => merchantApi.closeTableSession(tenantId, outletId, selectedSession.id),
              success: t("visitClosed", { label: selected.label }),
            },
            { onSuccess: () => setSelectedId(undefined) },
          )
        }
        canMerge={live.canMergeTables}
        claim={live.claims.find((claim) => claim.sessionId === selectedSession.id)}
        onConfirmClaim={(claim) =>
          confirm.mutate({ claim, label: selected.label, sessionId: selectedSession.id })
        }
        onRejectClaim={(claim) =>
          action.mutate({
            run: () =>
              merchantApi.rejectPaymentClaim(tenantId, outletId, selectedSession.id, claim.id),
            success: t("claimRejected", { label: selected.label }),
          })
        }
        destinations={live.tables
          .filter((table) => table.status === "AVAILABLE" && table.id !== selected.id)
          // The floor on screen first, then the others in their order.
          .sort(
            (left, right) =>
              floorRank(left.areaId) - floorRank(right.areaId) ||
              left.label.localeCompare(right.label, undefined, { numeric: true }),
          )}
        floors={live.floors}
        onMove={(to) =>
          action.mutate(
            {
              run: () =>
                merchantApi.moveTableSession(tenantId, outletId, selectedSession.id, {
                  tableId: to.id,
                }),
              success: t("visitMoved", { from: selected.label, to: to.label }),
            },
            { onSuccess: () => setSelectedId(to.id) },
          )
        }
        onDocument={() => setDocumentId(selectedSession.id)}
        onPay={(dueMinor) => setPaying({ dueMinor, sessionId: selectedSession.id })}
        outletId={outletId}
        session={selectedSession}
        table={selected}
        tenantId={tenantId}
        title={panelTitle(selected)}
        titleHidden={!wide}
      />
    ) : (
      <TablePanel
        busy={action.isPending}
        canSeat={allowed.canSeat}
        key={selected.id}
        onClean={() =>
          action.mutate(
            {
              run: () => merchantApi.cleanTable(tenantId, outletId, selected.id),
              success: t("tableCleaned", { label: selected.label }),
            },
            { onSuccess: () => setSelectedId(undefined) },
          )
        }
        onOpen={(guestCount) =>
          action.mutate({
            run: () =>
              merchantApi.openTableSession(tenantId, outletId, {
                guestCount,
                tableId: selected.id,
              }),
            success: t("tableOpened", { count: guestCount, label: selected.label }),
          })
        }
        table={selected}
        title={panelTitle(selected)}
        titleHidden={!wide}
      />
    )
  ) : null;

  return (
    <>
      <PageHeader title={t("posTitle")} />
      {live.requests.length > 0 || live.claims.length > 0 ? (
        <section
          aria-labelledby="guest-requests"
          className="mb-4 rounded-md border border-line-default bg-surface"
        >
          <h2
            className="m-0 border-b border-line-subtle px-4 py-2 text-label font-semibold"
            id="guest-requests"
          >
            {t("requestsTitle")}
          </h2>
          <ul className="m-0 list-none divide-y divide-line-subtle p-0">
            {live.requests.map((request) => {
              const table = live.tables.find((item) => item.sessionId === request.sessionId);
              const label = table?.label ?? "";
              return (
                <li
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2"
                  key={request.id}
                >
                  <button
                    className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-start text-body-sm text-foreground"
                    onClick={() => table && setSelectedId(table.id)}
                    type="button"
                  >
                    <span className="font-semibold">{label}</span> · {t(`request.${request.type}`)}{" "}
                    <span className="text-foreground-secondary">
                      · {t("requestAge", { minutes: minutesSince(request.requestedAt, now) })}
                    </span>
                  </button>
                  {allowed.canSeat ? (
                    <Button
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({
                          run: () =>
                            merchantApi.finishServiceRequest(tenantId, outletId, request.id),
                          success: t("requestDone", { label }),
                        })
                      }
                      size="sm"
                      variant="secondary"
                    >
                      {t("requestDoneAction")}
                    </Button>
                  ) : null}
                </li>
              );
            })}
            {live.claims.map((claim) => {
              const table = live.tables.find((item) => item.sessionId === claim.sessionId);
              return (
                <li className="px-4 py-2" key={claim.id}>
                  <button
                    className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-start text-body-sm text-foreground"
                    onClick={() => table && setSelectedId(table.id)}
                    type="button"
                  >
                    <span className="font-semibold">{table?.label ?? ""}</span> ·{" "}
                    {t(`claim.${claim.method}`)} · {money(claim.amountMinor)}{" "}
                    <span className="text-foreground-secondary">
                      · {t("requestAge", { minutes: minutesSince(claim.claimedAt, now) })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
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
      {!wide && selected && !documentId ? (
        <Sheet
          closeLabel={t("close")}
          {...(restoreDocumentFocus ? { initialFocusSelector: "[data-visit-document-open]" } : {})}
          onOpenChange={(open) => {
            if (!open) {
              setRestoreDocumentFocus(false);
              setSelectedId(undefined);
            }
          }}
          open
          size="sm"
          title={panelTitle(selected)}
        >
          {panel}
        </Sheet>
      ) : null}
      {documentSheet}
    </>
  );
}

/** A table without guests: seat them, or mark it ready once cleaned. */
function TablePanel({
  busy,
  canSeat,
  onClean,
  onOpen,
  table,
  title,
  titleHidden,
}: Readonly<{
  busy: boolean;
  canSeat: boolean;
  onClean: () => void;
  onOpen: (guestCount: number) => void;
  table: LiveTable;
  title: string;
  /** In a sheet the sheet already names the table. */
  titleHidden: boolean;
}>) {
  const t = useTranslations("floor");
  const [guests, setGuests] = useState(Math.min(table.capacity, 2));
  const statusText = t(`tableStatus.${table.status}`);

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

  const seatable = canSeat && table.status === "AVAILABLE";
  return (
    <TableSessionPanel
      actions={
        seatable ? (
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
      {seatable ? (
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

/** Guests at a table: their orders, what they still owe, and what comes next. */
function VisitPanel({
  allowed,
  busy,
  canMerge,
  claim,
  onConfirmClaim,
  onRejectClaim,
  destinations,
  floors,
  now,
  onClose,
  onMove,
  onPay,
  onDocument,
  outletId,
  session,
  table,
  tenantId,
  title,
  titleHidden,
}: Readonly<{
  allowed: Permissions;
  busy: boolean;
  /** Whether the package lets a visit take more tables (Pro). */
  canMerge: boolean;
  /** The guests say they paid; the cashier decides. */
  claim: PaymentClaim | undefined;
  onConfirmClaim: (claim: PaymentClaim) => void;
  onRejectClaim: (claim: PaymentClaim) => void;
  /** Free tables the guests may move to. */
  destinations: readonly LiveTable[];
  floors: LiveFloor["floors"];
  now: number;
  onClose: () => void;
  onMove: (to: LiveTable) => void;
  onPay: (dueMinor: string) => void;
  onDocument: () => void;
  outletId: string;
  session: TableSession;
  table: LiveTable;
  tenantId: string;
  title: string;
  titleHidden: boolean;
}>) {
  const t = useTranslations("floor");
  const doc = useTranslations("visitDocument");
  const router = useRouter();
  const { locale, money, time } = useFormat();
  const moderation = useGuestOrderDecision(tenantId, outletId);
  const blocked = busy || moderation.isPending;
  const detail = useQuery({
    queryFn: () => merchantApi.tableSessionDetail(tenantId, outletId, session.id),
    queryKey: visitKey(tenantId, outletId, session.id),
    refetchInterval: LIVE_FLOOR_REFRESH_MS,
  });
  const minutes = minutesSince(session.openedAt, now);
  const visit: TableSessionDetail | undefined = detail.data;
  const owing = visit ? BigInt(visit.dueMinor) > 0n : false;
  const pending = visit ? visitHasPending(visit.orders) : false;
  const [moving, setMoving] = useState(false);
  const [target, setTarget] = useState<LiveTable>();

  if (moving) {
    const areaName = new Map(
      floors.flatMap((floor) =>
        floor.areas.map((area) => [area.id, `${floor.name} · ${area.name}`] as const),
      ),
    );
    return (
      <TableSessionPanel
        actions={
          <>
            <Button disabled={!target || blocked} onClick={() => target && onMove(target)}>
              {target ? t("moveTo", { label: target.label }) : t("chooseDestination")}
            </Button>
            <Button onClick={() => setMoving(false)} variant="ghost">
              {t("cancel")}
            </Button>
          </>
        }
        facts={[]}
        status={t("moveFrom", { label: table.label })}
        title={title}
        titleHidden={titleHidden}
      >
        {destinations.length === 0 ? (
          <p className="m-0 text-body-sm text-foreground-secondary">{t("noFreeTable")}</p>
        ) : (
          <ul
            aria-label={t("destinations")}
            className="m-0 grid max-h-80 list-none gap-2 overflow-auto p-0"
          >
            {destinations.map((item) => (
              <li key={item.id}>
                <button
                  aria-pressed={target?.id === item.id}
                  className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-start ${
                    target?.id === item.id
                      ? "border-primary bg-primary-subtle"
                      : "border-line-default"
                  }`}
                  onClick={() => setTarget(item)}
                  type="button"
                >
                  <span className="text-label font-semibold">{item.label}</span>
                  <span className="text-caption text-foreground-secondary">
                    {areaName.get(item.areaId)} · {t("seatsShort", { count: item.capacity })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </TableSessionPanel>
    );
  }

  // One main step at a time: pay while something is owed, close once nothing is.
  const actions = (
    <>
      {claim && allowed.canPay && detail.isSuccess ? (
        <>
          {!pending ? (
            <Button size="lg" disabled={blocked} onClick={() => onConfirmClaim(claim)}>
              {t("confirmClaim")}
            </Button>
          ) : null}
        </>
      ) : visit && owing && !pending && allowed.canPay && detail.isSuccess ? (
        <Button size="lg" disabled={blocked} onClick={() => onPay(visit.dueMinor)}>
          {t("pay")}
        </Button>
      ) : null}
      {visit && !owing && !pending && allowed.canSeat && detail.isSuccess ? (
        <Button size="lg" disabled={blocked} onClick={onClose}>
          {t("closeVisit")}
        </Button>
      ) : null}
      {allowed.canOrder ? (
        <Button
          size="lg"
          variant="secondary"
          disabled={blocked}
          onClick={onDocument}
          data-visit-document-open
        >
          {doc("open")}
        </Button>
      ) : null}
      {allowed.canMove || allowed.canOrder || (claim && allowed.canPay) ? (
        <div className="[--control-height-sm:var(--control-height-lg)] [&_button]:min-h-12 [&_button]:min-w-12">
          <DropdownMenu
            side="top"
            label={doc("moreActions")}
            trigger={doc("moreActions")}
            items={[
              ...(allowed.canOrder
                ? [
                    {
                      label: t("addOrder"),
                      disabled: blocked,
                      onSelect: () => router.push(`/pos?table=${session.id}`),
                    },
                  ]
                : []),
              ...(allowed.canMove
                ? [{ label: t("moveTable"), disabled: blocked, onSelect: () => setMoving(true) }]
                : []),
              ...(claim && allowed.canPay
                ? [
                    {
                      label: t("rejectClaim"),
                      disabled: blocked,
                      destructive: true,
                      onSelect: () => onRejectClaim(claim),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      ) : null}
    </>
  );

  return (
    <TableSessionPanel
      actions={actions}
      facts={[
        { label: t("guests"), value: session.guestCount },
        { label: t("seatedSince"), value: time(session.openedAt) },
        { label: t("seatedFor"), value: t("durationLabel", { minutes }) },
        ...(visit && !(pending && !owing)
          ? [
              {
                label: t("due"),
                value: <MoneyDisplay amountMinor={visit.dueMinor} locale={locale} />,
              },
            ]
          : []),
      ]}
      status={t(`tableStatus.${table.status}`)}
      title={title}
      titleHidden={titleHidden}
    >
      {claim ? (
        <Alert title={t(`claim.${claim.method}`)} tone="info">
          {t("claimNotice", { amount: money(claim.amountMinor) })}
        </Alert>
      ) : null}
      {detail.isPending ? <Skeleton variant="table-row" /> : null}
      {detail.isError ? (
        <RequestErrorState
          error={detail.error}
          onRetry={() => void detail.refetch()}
          title={t("visitLoadFailed")}
        />
      ) : null}
      {visit ? (
        <VisitOrders
          busy={blocked}
          activeOrderId={moderation.isPending ? moderation.variables?.orderId : undefined}
          canAccept={allowed.canOrder}
          canReject={allowed.canRejectOrder}
          onDecision={(input) => moderation.mutateAsync(input)}
          orders={visit.orders}
          reviewable={detail.isSuccess}
        />
      ) : null}
      {/* Joining or splitting tables comes with Tables Pro; Basic shows that it exists. */}
      {!canMerge ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3">
          <Button disabled iconLeft={IconLock} size="sm" variant="secondary">
            {t("mergeTables")}
          </Button>
          <span className="flex items-center gap-1 text-caption text-foreground-secondary">
            <AppIcon icon={IconLock} size="xs" />
            {t("mergeLocked")}
          </span>
        </div>
      ) : null}
    </TableSessionPanel>
  );
}

/** A visit paid at once: what was taken, the change, and the sale of each order. */
function VisitPaid({
  checkout,
  onDone,
  onDocument,
}: Readonly<{
  checkout: TableSessionCheckout;
  onDone: () => void;
  onDocument: (() => void) | undefined;
}>) {
  const t = useTranslations("floor");
  const pos = useTranslations("pos");
  const doc = useTranslations("visitDocument");
  const { locale } = useFormat();
  const { payment } = checkout;
  const row = "flex items-baseline justify-between gap-3 py-3";
  return (
    <div className="mx-auto grid w-full max-w-md gap-6">
      <h1 className="m-0 text-heading-lg">{t("visitPaid")}</h1>
      <dl className="m-0 divide-y divide-line-subtle border-y border-line-default">
        <div className={row}>
          <dt className="text-body-sm text-foreground-secondary">{t("saleNumbers")}</dt>
          <dd className="m-0 text-label font-semibold">
            {checkout.checkouts.map(({ sale }) => `#${sale.saleNumber}`).join(", ")}
          </dd>
        </div>
        <div className={row}>
          <dt className="text-body-sm text-foreground-secondary">{pos("total")}</dt>
          <dd className="m-0">
            <MoneyDisplay amountMinor={payment.amountMinor} locale={locale} />
          </dd>
        </div>
        {payment.tenderedMinor !== null && payment.changeMinor !== null ? (
          <>
            <div className={row}>
              <dt className="text-body-sm text-foreground-secondary">{pos("tendered")}</dt>
              <dd className="m-0">
                <MoneyDisplay amountMinor={payment.tenderedMinor} locale={locale} />
              </dd>
            </div>
            <div className={row}>
              <dt className="text-label font-semibold">{pos("change")}</dt>
              <dd className="m-0">
                <MoneyDisplay amountMinor={payment.changeMinor} locale={locale} variant="total" />
              </dd>
            </div>
          </>
        ) : null}
      </dl>
      {onDocument ? (
        <Button
          fullWidth
          onClick={onDocument}
          size="lg"
          variant="secondary"
          data-visit-document-open
        >
          {doc("open")}
        </Button>
      ) : null}
      <Button fullWidth onClick={onDone} size="lg">
        {t("backToTables")}
      </Button>
    </div>
  );
}
