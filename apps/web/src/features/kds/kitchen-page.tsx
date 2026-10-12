"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { IconPlus } from "@tabler/icons-react";

import { PERMISSIONS, type KitchenTicket } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@merchant/ui/feedback";
import { KdsTicket } from "@merchant/ui/kds-ticket";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { Tabs } from "@merchant/ui/navigation";

import { useWorkspace } from "@/features/workspace";
import { useMediaQuery } from "@/lib/use-media-query";
import { RequestErrorState } from "@/shell/request-error-state";

import { useAdvanceTicket, useFinishedTickets, useKitchenQueue } from "./api";
import { ManualTicketSheet } from "./manual-ticket-sheet";
import {
  BOARD_STATUSES,
  componentStatus,
  formatElapsed,
  groupByStatus,
  isBoardStatus,
  waitedMilliseconds,
} from "./ticket-view";

type View = "finished" | "queue";

/** The current time, read again every second so waiting times count up. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** One ticket as the kitchen reads it, with the one next step when the viewer may take it. */
function Ticket({
  busy,
  now,
  onAdvance,
  ticket,
}: Readonly<{
  busy?: boolean;
  now: number;
  /** Left out for a viewer who may only look, and for finished tickets. */
  onAdvance?: (ticket: KitchenTicket) => void;
  ticket: KitchenTicket;
}>) {
  const t = useTranslations("kds");
  const open = isBoardStatus(ticket.status);
  return (
    <KdsTicket
      {...(open && onAdvance
        ? {
            action: {
              ...(busy ? { busy } : {}),
              label: t(`action.${ticket.status}` as "action.NEW"),
              onAction: () => onAdvance(ticket),
            },
          }
        : {})}
      {...(ticket.tableLabel ? { tableLabel: ticket.tableLabel } : {})}
      allergyLabel={t("allergy")}
      elapsedLabel={formatElapsed(waitedMilliseconds(ticket, now))}
      fill
      items={ticket.items.map((item) => ({
        ...(item.allergyNote ? { allergyNote: item.allergyNote } : {}),
        modifiers: item.modifiers,
        name: item.name,
        ...(item.note ? { note: item.note } : {}),
        quantity: item.quantity,
      }))}
      label={t("ticketLabel", { label: ticket.orderLabel })}
      orderLabel={ticket.orderLabel}
      size="lg"
      sourceLabel={t(`source.${ticket.source}`)}
      status={componentStatus(ticket.status)}
      statusLabel={t(`status.${ticket.status}`)}
      timerLabel={t(open ? "waiting" : "took")}
      variant={open ? "touch" : "history"}
    />
  );
}

function LoadingTickets() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Skeleton variant="ticket" />
      <Skeleton variant="ticket" />
      <Skeleton variant="ticket" />
    </div>
  );
}

function Queue({
  canManage,
  outletId,
  tenantId,
}: Readonly<{ canManage: boolean; outletId: string; tenantId: string }>) {
  const t = useTranslations("kds");
  const now = useNow();
  const wide = useMediaQuery("(min-width: 1024px)");
  const query = useKitchenQueue(tenantId, outletId);
  const advance = useAdvanceTicket(tenantId, outletId);
  const busyId = advance.isPending ? advance.variables?.id : undefined;
  const onAdvance = canManage
    ? (ticket: KitchenTicket) => advance.mutate({ id: ticket.id, status: ticket.status })
    : undefined;

  if (query.isPending) return <LoadingTickets />;
  if (query.isError) {
    return (
      <RequestErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        title={t("loadFailed")}
      />
    );
  }
  const tickets = query.data.tickets;
  if (tickets.length === 0) {
    return <EmptyState description={t("queueEmptyDescription")} title={t("queueEmpty")} />;
  }
  const card = (ticket: KitchenTicket) => (
    <li key={ticket.id}>
      <Ticket
        busy={busyId === ticket.id}
        now={now}
        ticket={ticket}
        {...(onAdvance ? { onAdvance } : {})}
      />
    </li>
  );

  // A wide screen is a board with a column per status; a narrow one is a
  // single list, longest waiting first, whatever the status.
  if (!wide) {
    return <ul className="m-0 grid list-none gap-4 p-0">{tickets.map(card)}</ul>;
  }
  const groups = groupByStatus(tickets);
  return (
    <div className="grid grid-cols-4 items-start gap-4">
      {BOARD_STATUSES.map((status) => {
        const column = groups.get(status) ?? [];
        return (
          <section aria-labelledby={`kds-column-${status}`} className="grid gap-3" key={status}>
            <h2
              className="flex items-baseline justify-between border-b border-line-default pb-2 text-heading-sm"
              id={`kds-column-${status}`}
            >
              <span>{t(`status.${status}`)}</span>
              <span className="text-body-sm tabular-nums text-foreground-secondary">
                {column.length}
              </span>
            </h2>
            <ul className="m-0 grid list-none gap-4 p-0">{column.map(card)}</ul>
          </section>
        );
      })}
    </div>
  );
}

function Finished({ outletId, tenantId }: Readonly<{ outletId: string; tenantId: string }>) {
  const t = useTranslations("kds");
  const query = useFinishedTickets(tenantId, outletId, true);

  if (query.isPending) return <LoadingTickets />;
  if (query.isError) {
    return (
      <RequestErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        title={t("loadFailed")}
      />
    );
  }
  if (query.data.tickets.length === 0) {
    return <EmptyState description={t("finishedEmptyDescription")} title={t("finishedEmpty")} />;
  }
  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
      {query.data.tickets.map((ticket) => (
        <li key={ticket.id}>
          {/* A finished ticket's time no longer counts up. */}
          <Ticket now={0} ticket={ticket} />
        </li>
      ))}
    </ul>
  );
}

/** The kitchen screen of the active outlet: what to prepare, and what was finished today. */
export function KitchenPage() {
  const t = useTranslations("kds");
  const { can, outlet, workspace } = useWorkspace();
  const [view, setView] = useState<View>("queue");
  const [adding, setAdding] = useState(false);

  if (!can(PERMISSIONS.kdsTicketView)) {
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
  const canManage = can(PERMISSIONS.kdsTicketManage);

  return (
    <div className="grid gap-4" key={`${tenantId}:${outlet.id}`}>
      <h1 className="sr-only">{t("title")}</h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[
            { label: t("viewQueue"), value: "queue" },
            { label: t("viewFinished"), value: "finished" },
          ]}
          label={t("views")}
          onValueChange={(value) => setView(value === "finished" ? "finished" : "queue")}
          value={view}
        />
        {canManage ? (
          <Button iconLeft={IconPlus} onClick={() => setAdding(true)}>
            {t("addTicket")}
          </Button>
        ) : null}
      </div>
      {view === "queue" ? (
        <Queue canManage={canManage} outletId={outlet.id} tenantId={tenantId} />
      ) : (
        <Finished outletId={outlet.id} tenantId={tenantId} />
      )}
      {adding ? (
        <ManualTicketSheet
          onClose={() => setAdding(false)}
          outletId={outlet.id}
          tenantId={tenantId}
        />
      ) : null}
    </div>
  );
}
