"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { PERMISSIONS, type RegisterSession } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { DataTable, Panel } from "@merchant/ui/data-display";
import { ErrorState, Skeleton } from "@merchant/ui/feedback";
import { MoneyDisplay } from "@merchant/ui/money-display";
import { PageHeader } from "@merchant/ui/page";
import { CloseShiftForm, OpenShiftForm, ShiftSummary } from "@merchant/ui/pos-shift";
import { Sheet } from "@merchant/ui/sheet";

import { useWorkspace } from "@/features/workspace";
import { useErrorMessage, useFormat } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";

import { useCurrentShift, useShiftMutations } from "./api";
import { CashMovementSheet } from "./cash-movement-sheet";

const VARIANCE_REASON_MIN_LENGTH = 3;

type Mutations = ReturnType<typeof useShiftMutations>;

function OpenShift({ mutations }: Readonly<{ mutations: Mutations }>) {
  const t = useTranslations("pos");
  const { locale } = useFormat();
  const notify = useToast();
  const [openingCash, setOpeningCash] = useState<number | undefined>();

  return (
    <OpenShiftForm
      labels={{ openingCash: t("openingCash"), submit: t("open"), submitting: t("opening") }}
      loading={mutations.open.isPending}
      locale={locale}
      onOpeningCashChange={setOpeningCash}
      onSubmit={() => {
        if (openingCash === undefined) return;
        mutations.open.mutate(
          { openingCashMinor: String(openingCash) },
          { onSuccess: () => notify({ message: t("shiftOpened"), tone: "success" }) },
        );
      }}
      {...(openingCash === undefined ? {} : { openingCashMinor: openingCash })}
    />
  );
}

function CloseShiftSheet({
  mutations,
  onClose,
  shift,
}: Readonly<{ mutations: Mutations; onClose: () => void; shift: RegisterSession }>) {
  const t = useTranslations("pos");
  const { locale } = useFormat();
  const notify = useToast();
  const [countedCash, setCountedCash] = useState<number | undefined>();
  const [reason, setReason] = useState("");

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("close")}
    >
      <CloseShiftForm
        expectedCashMinor={shift.expectedCashMinor}
        labels={{
          countedCash: t("countedCash"),
          countedCashRequired: t("countedCashRequired"),
          expectedCash: t("expectedCash"),
          reason: t("varianceReason"),
          reasonRequired: t("varianceReasonRequired"),
          submit: t("close"),
          submitting: t("closing"),
          varianceBalanced: t("varianceBalanced"),
          varianceNeedsReason: t("varianceNeedsReason"),
        }}
        loading={mutations.close.isPending}
        locale={locale}
        onCountedCashChange={setCountedCash}
        onReasonChange={setReason}
        onSubmit={() => {
          if (countedCash === undefined) return;
          const balanced = BigInt(countedCash) === BigInt(shift.expectedCashMinor);
          mutations.close.mutate(
            {
              input: {
                countedCashMinor: String(countedCash),
                ...(balanced ? {} : { varianceReason: reason.trim() }),
              },
              shiftId: shift.id,
            },
            { onSuccess: () => notify({ message: t("shiftClosed"), tone: "success" }) },
          );
        }}
        reason={reason}
        reasonMinLength={VARIANCE_REASON_MIN_LENGTH}
        {...(countedCash === undefined ? {} : { countedCashMinor: countedCash })}
      />
    </Sheet>
  );
}

function OpenShiftView({
  canClose,
  mutations,
  shift,
}: Readonly<{ canClose: boolean; mutations: Mutations; shift: RegisterSession }>) {
  const t = useTranslations("pos");
  const { dateTime, locale } = useFormat();
  const notify = useToast();
  const [sheet, setSheet] = useState<"cash" | "close" | undefined>();
  // One key per intended movement: a retry after a lost response is not recorded twice.
  const [movementKey, setMovementKey] = useState(() => crypto.randomUUID());

  return (
    <>
      <PageHeader
        {...(canClose
          ? { primaryAction: <Button onClick={() => setSheet("close")}>{t("close")}</Button> }
          : {})}
        secondaryActions={
          <Button onClick={() => setSheet("cash")} variant="secondary">
            {t("recordCash")}
          </Button>
        }
        title={t("title")}
      />
      <div className="grid gap-4">
        <Panel title={t("cash")}>
          <div className="p-4">
            <ShiftSummary
              cashInMinor={shift.cashInMinor}
              cashOutMinor={shift.cashOutMinor}
              cashSalesMinor={shift.cashSalesMinor}
              expectedCashMinor={shift.expectedCashMinor}
              facts={[{ label: t("openedAt"), value: dateTime(shift.openedAt) }]}
              labels={{
                cashIn: t("cashIn"),
                cashOut: t("cashOut"),
                cashSales: t("cashSales"),
                countedCash: t("countedCash"),
                expectedCash: t("expectedCash"),
                nonCash: t("nonCash"),
                openingCash: t("openingCash"),
                variance: t("variance"),
              }}
              locale={locale}
              openingCashMinor={shift.openingCashMinor}
              status="active"
            />
          </div>
        </Panel>
        {shift.movements.length > 0 ? (
          <Panel title={t("cashLog")}>
            <DataTable
              caption={t("cashLog")}
              columns={[
                { label: t("time"), priority: 2 },
                t("direction"),
                t("note"),
                { align: "end", label: t("amount") },
              ]}
              rows={shift.movements.map((movement) => [
                dateTime(movement.createdAt),
                movement.direction === "IN" ? t("directionIn") : t("directionOut"),
                movement.reason,
                <MoneyDisplay amountMinor={movement.amountMinor} key="amount" locale={locale} />,
              ])}
            />
          </Panel>
        ) : null}
      </div>

      {sheet === "cash" ? (
        <CashMovementSheet
          drawerCashMinor={shift.expectedCashMinor}
          onClose={() => setSheet(undefined)}
          onSubmit={(input) =>
            mutations.recordCash.mutate(
              { idempotencyKey: movementKey, input, shiftId: shift.id },
              {
                onSuccess: () => {
                  setMovementKey(crypto.randomUUID());
                  setSheet(undefined);
                  notify({ message: t("cashRecorded"), tone: "success" });
                },
              },
            )
          }
          saving={mutations.recordCash.isPending}
        />
      ) : null}
      {sheet === "close" ? (
        <CloseShiftSheet mutations={mutations} onClose={() => setSheet(undefined)} shift={shift} />
      ) : null}
    </>
  );
}

function ShiftForOutlet({
  canClose,
  outletId,
  tenantId,
}: Readonly<{ canClose: boolean; outletId: string; tenantId: string }>) {
  const t = useTranslations("pos");
  const errorMessage = useErrorMessage();
  const current = useCurrentShift(tenantId, outletId, true);
  const mutations = useShiftMutations(tenantId, outletId);

  if (current.isPending) {
    return (
      <>
        <PageHeader title={t("title")} />
        <Skeleton variant="metric-card" />
      </>
    );
  }

  if (current.isError) {
    return (
      <>
        <PageHeader title={t("title")} />
        <ErrorState
          action={
            <Button onClick={() => void current.refetch()} variant="secondary">
              {t("retry")}
            </Button>
          }
          description={errorMessage(current.error)}
          title={t("loadFailed")}
        />
      </>
    );
  }

  if (!current.data.session) {
    return (
      <>
        <PageHeader title={t("title")} />
        <OpenShift mutations={mutations} />
      </>
    );
  }

  return <OpenShiftView canClose={canClose} mutations={mutations} shift={current.data.session} />;
}

/** The cashier's own shift at the active outlet: open it, record cash, close it. */
export function ShiftPage() {
  const t = useTranslations("pos");
  const { can, outlet, workspace } = useWorkspace();

  if (!can(PERMISSIONS.shiftOpen)) {
    return <ErrorState description={t("accessDenied")} title={t("accessDeniedTitle")} />;
  }
  if (!outlet) {
    return <ErrorState description={t("noOutlet")} title={t("accessDeniedTitle")} />;
  }

  // Keyed by outlet so half-entered amounts never carry over to another outlet.
  return (
    <ShiftForOutlet
      canClose={can(PERMISSIONS.shiftClose)}
      key={`${workspace.tenant.id}:${outlet.id}`}
      outletId={outlet.id}
      tenantId={workspace.tenant.id}
    />
  );
}
