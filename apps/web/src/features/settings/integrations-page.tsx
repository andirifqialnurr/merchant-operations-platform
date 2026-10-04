"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { PERMISSIONS, type IntegrationBinding } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { DataTable, Panel } from "@merchant/ui/data-display";
import { Badge, EmptyState, type FeedbackTone, Skeleton } from "@merchant/ui/feedback";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { PageHeader } from "@merchant/ui/page";

import { useWorkspace } from "@/features/workspace";
import { ApiClientError, merchantApi } from "@/lib/api-client";
import { RequestErrorState } from "@/shell/request-error-state";

import { useIntegrationMutation, useIntegrations } from "./api";
import { canRetryIntegration, integrationState, type IntegrationState } from "./integration-status";

const stateTone: Record<IntegrationState, FeedbackTone> = {
  ACTIVE: "success",
  FAILED: "danger",
  PAUSED: "neutral",
  PROCESSING: "info",
  SETUP_REQUIRED: "warning",
};

export function IntegrationsPage() {
  const t = useTranslations("integrations");
  const moduleNames = useTranslations("subscription");
  const { can, workspace } = useWorkspace();
  const tenantId = workspace.tenant.id;
  // Integrations connect modules of the whole business, not of one outlet.
  const canRead = can(PERMISSIONS.organizationRead) && workspace.allOutlets;
  const canManage = canRead && can(PERMISSIONS.organizationManage);
  const query = useIntegrations(tenantId, canRead);
  const mutation = useIntegrationMutation(tenantId);
  // One key per attempt to try again: a repeat after a lost connection is the same request.
  const retryKeys = useRef(new Map<string, string>());

  if (!canRead) {
    return (
      <ModuleAccessState
        description={t("accessDenied")}
        reason="permission-denied"
        title={t("accessDeniedTitle")}
      />
    );
  }

  const moduleName = (key: string) =>
    moduleNames.has(`moduleName.${key}` as never) ? moduleNames(`moduleName.${key}` as never) : key;

  function retry(binding: IntegrationBinding) {
    const key = retryKeys.current.get(binding.id) ?? crypto.randomUUID();
    retryKeys.current.set(binding.id, key);
    mutation.mutate(
      {
        action: () => merchantApi.retryIntegration(tenantId, binding.id, key),
        success: t("retryQueued"),
      },
      {
        // The server answered, so the next press is a new request.
        onError: (error) => {
          if (error instanceof ApiClientError) retryKeys.current.delete(binding.id);
        },
        onSuccess: () => retryKeys.current.delete(binding.id),
      },
    );
  }

  const rows = (query.data?.bindings ?? []).flatMap((binding) => {
    const state = integrationState(binding);
    return state ? [{ binding, state }] : [];
  });
  const hasActions = canManage && rows.some((row) => canRetryIntegration(row.state));

  return (
    <>
      <PageHeader title={t("title")} />
      {query.isPending ? (
        <div className="grid gap-2">
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
        <Panel>
          <DataTable
            caption={t("title")}
            columns={[
              t("integration"),
              t("status"),
              { label: t("note"), priority: 2 },
              ...(hasActions ? [{ align: "end" as const, label: t("action") }] : []),
            ]}
            empty={<EmptyState description={t("empty")} title={t("emptyTitle")} />}
            rows={rows.map(({ binding, state }) => [
              t("connection", {
                source: moduleName(binding.sourceModuleKey),
                target: moduleName(binding.targetModuleKey),
              }),
              <Badge key="state" tone={stateTone[state]}>
                {t(`state.${state}`)}
              </Badge>,
              t(`hint.${state}`, {
                source: moduleName(binding.sourceModuleKey),
                target: moduleName(binding.targetModuleKey),
              }),
              ...(hasActions
                ? [
                    canRetryIntegration(state) ? (
                      <Button
                        disabled={mutation.isPending}
                        key="retry"
                        onClick={() => retry(binding)}
                        size="sm"
                        variant="secondary"
                      >
                        {t("retry")}
                      </Button>
                    ) : null,
                  ]
                : []),
            ])}
          />
        </Panel>
      )}
    </>
  );
}
