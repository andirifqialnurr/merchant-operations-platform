"use client";

import { useTranslations } from "next-intl";

import {
  PERMISSIONS,
  type SubscriptionOverview,
  type SubscriptionStatus,
  type UsageMeter as UsageMeterData,
} from "@merchant/contracts";
import { DescriptionList, Panel } from "@merchant/ui/data-display";
import { Badge, EmptyState, type FeedbackTone, Skeleton } from "@merchant/ui/feedback";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { PageHeader } from "@merchant/ui/page";
import { UsageMeter } from "@merchant/ui/usage-limit-state";

import { useWorkspace } from "@/features/workspace";
import { useFormat } from "@/lib/i18n";
import { RequestErrorState } from "@/shell/request-error-state";
import { useUsageMeterLabels } from "@/shell/usage-labels";

import { useSubscriptionOverview } from "./api";

const statusTone: Record<SubscriptionStatus, FeedbackTone> = {
  ACTIVE: "success",
  CANCELED_AT_PERIOD_END: "warning",
  DRAFT: "neutral",
  GRACE: "warning",
  SUSPENDED: "danger",
  TERMINATED: "danger",
  TRIAL: "info",
};

function Meters({ meters }: Readonly<{ meters: readonly UsageMeterData[] }>) {
  const meterProps = useUsageMeterLabels();
  return (
    <ul className="m-0 grid list-none gap-5 p-0">
      {meters.map((meter) => (
        <li key={meter.dimensionKey}>
          <UsageMeter {...meterProps(meter)} />
        </li>
      ))}
    </ul>
  );
}

function Overview({ overview }: Readonly<{ overview: SubscriptionOverview }>) {
  const t = useTranslations("subscription");
  const { date } = useFormat();
  const { subscription } = overview;

  if (!subscription) {
    return <EmptyState description={t("noSubscription")} title={t("noSubscriptionTitle")} />;
  }

  return (
    <div className="grid gap-6">
      <Panel title={t("plan")}>
        <div className="p-4">
          <DescriptionList
            items={[
              { label: t("planName"), value: subscription.planName },
              {
                label: t("statusLabel"),
                value: (
                  <Badge tone={statusTone[subscription.status]}>
                    {t(`status.${subscription.status}`)}
                  </Badge>
                ),
              },
              // Rows without a date are left out rather than shown empty.
              ...(subscription.endsAt
                ? [{ label: t("endsAt"), value: date(subscription.endsAt) }]
                : []),
              ...(subscription.graceEndsAt
                ? [{ label: t("graceEndsAt"), value: date(subscription.graceEndsAt) }]
                : []),
            ]}
          />
        </div>
      </Panel>

      <Panel title={t("modules")}>
        <div className="p-4">
          {overview.modules.length > 0 ? (
            <DescriptionList
              items={overview.modules.map((module) => ({
                // A module this build cannot name yet is shown by its key rather than hidden.
                label: t.has(`moduleName.${module.key}` as never)
                  ? t(`moduleName.${module.key}` as never)
                  : module.key,
                value: t(`tier.${module.tier}`),
              }))}
            />
          ) : (
            <EmptyState description={t("noModules")} title={t("noModulesTitle")} />
          )}
        </div>
      </Panel>

      <Panel title={t("usage")}>
        <div className="p-4">
          {overview.meters.length > 0 ? (
            <Meters meters={overview.meters} />
          ) : (
            <EmptyState description={t("noLimits")} title={t("noLimitsTitle")} />
          )}
        </div>
      </Panel>
    </div>
  );
}

export function SubscriptionPage() {
  const t = useTranslations("subscription");
  const { can, workspace } = useWorkspace();
  // The subscription belongs to the whole business, not to one outlet.
  const allowed = can(PERMISSIONS.organizationRead) && workspace.allOutlets;
  const query = useSubscriptionOverview(workspace.tenant.id, allowed);

  if (!allowed) {
    return (
      <ModuleAccessState
        description={t("accessDenied")}
        reason="permission-denied"
        title={t("accessDeniedTitle")}
      />
    );
  }

  return (
    <>
      <PageHeader title={t("title")} />
      {query.isPending ? (
        <div className="grid gap-2">
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
        </div>
      ) : query.isError ? (
        <RequestErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          title={t("loadFailed")}
        />
      ) : (
        <Overview overview={query.data} />
      )}
    </>
  );
}
