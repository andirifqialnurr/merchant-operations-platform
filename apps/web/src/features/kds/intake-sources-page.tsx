"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { IconCopy, IconPlus } from "@tabler/icons-react";

import {
  PERMISSIONS,
  type KdsIntakeSource,
  type KdsIntakeSourceCreated,
} from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { DataTable, Panel } from "@merchant/ui/data-display";
import { Badge, EmptyState, Skeleton } from "@merchant/ui/feedback";
import { FormField, Input } from "@merchant/ui/form-field";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { AlertDialog, Sheet } from "@merchant/ui/overlay";
import { PageHeader } from "@merchant/ui/page";
import { Select } from "@merchant/ui/select";

import { useWorkspace } from "@/features/workspace";
import { type ApiClientError, merchantApi } from "@/lib/api-client";
import { useFormat } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";
import { isLimitReached, LimitReachedState } from "@/shell/limit-reached-state";
import { RequestErrorState } from "@/shell/request-error-state";

import { type IntakeSourceMutation, useIntakeSourceMutation, useIntakeSources } from "./api";

/** Where an outside system sends its tickets; the same for every source. */
const INTAKE_PATH = "/api/v1/kds/intake/tickets";

/** The one moment the key is on screen, with what the outside system needs to use it. */
function NewKey({ created }: Readonly<{ created: KdsIntakeSourceCreated }>) {
  const t = useTranslations("kdsIntake");
  const notify = useToast();
  return (
    <div className="grid gap-4">
      <p className="m-0 text-label text-foreground-secondary">{t("keyInstruction")}</p>
      <div className="grid gap-2">
        <p className="m-0 text-label">{t("keyLabel")}</p>
        <code className="block break-all rounded-md border border-line-default bg-surface-subtle p-3 font-mono text-body-sm">
          {created.key}
        </code>
        <div>
          <Button
            iconLeft={IconCopy}
            onClick={() =>
              void navigator.clipboard.writeText(created.key).then(
                () => notify({ message: t("copied"), tone: "success" }),
                () => notify({ message: t("copyFailed"), tone: "danger" }),
              )
            }
            size="sm"
            variant="secondary"
          >
            {t("copy")}
          </Button>
        </div>
      </div>
      <div className="grid gap-2">
        <p className="m-0 text-label">{t("howToSend")}</p>
        <code className="block break-all rounded-md border border-line-default bg-surface-subtle p-3 font-mono text-body-sm">
          POST {INTAKE_PATH}
          <br />
          Authorization: Bearer {created.key.slice(0, 15)}…
        </code>
      </div>
      <p className="m-0 text-label font-semibold">{t("keyShownOnce")}</p>
    </div>
  );
}

function AddSheet({
  mutation,
  onClose,
  tenantId,
}: Readonly<{ mutation: IntakeSourceMutation; onClose: () => void; tenantId: string }>) {
  const t = useTranslations("kdsIntake");
  const { workspace } = useWorkspace();
  const outlets = workspace.outlets.filter((item) => item.status === "ACTIVE");
  const [label, setLabel] = useState("");
  const [outletId, setOutletId] = useState(outlets.length === 1 ? (outlets[0]?.id ?? "") : "");
  const [errors, setErrors] = useState<{ label?: string; outlet?: string }>({});
  const [created, setCreated] = useState<KdsIntakeSourceCreated>();
  const [limitError, setLimitError] = useState<ApiClientError>();

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = {
      ...(label.trim().length < 2 ? { label: t("labelRequired") } : {}),
      ...(outletId ? {} : { outlet: t("outletRequired") }),
    };
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    mutation.mutate(
      {
        action: () =>
          merchantApi.createKdsIntakeSource(tenantId, { label: label.trim(), outletId }),
        success: t("created"),
      },
      {
        onError: (error) => setLimitError(isLimitReached(error) ? error : undefined),
        onSuccess: (result) => setCreated(result as KdsIntakeSourceCreated),
      },
    );
  }

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      footer={
        created ? (
          <Button onClick={onClose}>{t("done")}</Button>
        ) : limitError ? undefined : (
          <Button
            form="intake-source-form"
            loading={mutation.isPending}
            loadingLabel={t("saving")}
            type="submit"
          >
            {t("add")}
          </Button>
        )
      }
      onOpenChange={(open) => {
        // Closing by accident would lose the key; only "Done" closes it then.
        if (!open && !created) onClose();
      }}
      open
      size="sm"
      title={created ? created.source.label : t("newSource")}
    >
      {created ? (
        <NewKey created={created} />
      ) : limitError ? (
        <LimitReachedState error={limitError} />
      ) : (
        <form className="grid gap-4" id="intake-source-form" noValidate onSubmit={submit}>
          <FormField
            {...(errors.label ? { error: errors.label } : {})}
            helperText={t("labelHint")}
            htmlFor="intake-source-label"
            label={t("label")}
          >
            <Input
              id="intake-source-label"
              maxLength={80}
              onChange={(event) => setLabel(event.target.value)}
              value={label}
            />
          </FormField>
          <Select
            {...(errors.outlet ? { error: errors.outlet } : {})}
            {...(outletId ? { value: outletId } : {})}
            emptyLabel={t("noOutlet")}
            label={t("outlet")}
            onValueChange={setOutletId}
            options={outlets.map((item) => ({ label: item.name, value: item.id }))}
            placeholder={t("selectOutlet")}
          />
        </form>
      )}
    </Sheet>
  );
}

function SourceSheet({
  mutation,
  onClose,
  source,
  tenantId,
}: Readonly<{
  mutation: IntakeSourceMutation;
  onClose: () => void;
  source: KdsIntakeSource;
  tenantId: string;
}>) {
  const t = useTranslations("kdsIntake");
  const { dateTime } = useFormat();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Sheet
        closeLabel={t("closeSheet")}
        footer={
          source.status === "ACTIVE" ? (
            <Button
              disabled={mutation.isPending}
              onClick={() => setConfirming(true)}
              variant="destructive"
            >
              {t("revoke")}
            </Button>
          ) : undefined
        }
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        open
        size="sm"
        title={source.label}
      >
        {/* What the list does not already say. */}
        <p className="m-0 text-label text-foreground-secondary">
          {source.revokedAt
            ? t("revokedAt", { date: dateTime(source.revokedAt) })
            : t("createdAt", { date: dateTime(source.createdAt) })}
        </p>
      </Sheet>
      <AlertDialog
        cancelLabel={t("cancel")}
        closeLabel={t("closeSheet")}
        confirmLabel={t("revoke")}
        onConfirm={() =>
          mutation.mutate(
            {
              action: () => merchantApi.revokeKdsIntakeSource(tenantId, source.id),
              success: t("revoked"),
            },
            { onSuccess: onClose },
          )
        }
        onOpenChange={setConfirming}
        open={confirming}
        title={t("revokeTitle", { label: source.label })}
      >
        {t("revokeDescription")}
      </AlertDialog>
    </>
  );
}

/** Settings > Outside systems: the keys that let other systems send kitchen tickets. */
export function IntakeSourcesPage() {
  const t = useTranslations("kdsIntake");
  const { dateTime } = useFormat();
  const { can, workspace } = useWorkspace();
  const tenantId = workspace.tenant.id;
  // Keys open the kitchen to systems outside the business: whole-business people only.
  const canManage = can(PERMISSIONS.kdsIntakeManage) && workspace.allOutlets;
  const query = useIntakeSources(tenantId, canManage);
  const mutation = useIntakeSourceMutation(tenantId);
  const [open, setOpen] = useState<string>();

  if (!canManage) {
    return (
      <ModuleAccessState
        description={t("accessDenied")}
        reason="permission-denied"
        title={t("accessDeniedTitle")}
      />
    );
  }

  const sources = query.data?.sources ?? [];
  const selected = sources.find((item) => item.id === open);
  const outletName = (id: string) => workspace.outlets.find((item) => item.id === id)?.name ?? "";

  return (
    <>
      <PageHeader
        primaryAction={
          <Button iconLeft={IconPlus} onClick={() => setOpen("new")}>
            {t("addSource")}
          </Button>
        }
        title={t("title")}
      />
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
              t("source"),
              { label: t("outlet"), priority: 2 },
              { label: t("keyStart"), priority: 3 },
              t("status"),
              { label: t("lastUsed"), priority: 2 },
            ]}
            empty={<EmptyState description={t("empty")} title={t("emptyTitle")} />}
            onRowSelect={(index: number) => setOpen(sources[index]?.id)}
            rows={sources.map((item) => [
              item.label,
              outletName(item.outletId),
              <code className="font-mono text-body-sm" key="prefix">
                kds_{item.keyPrefix}_…
              </code>,
              <Badge key="status" tone={item.status === "ACTIVE" ? "success" : "neutral"}>
                {t(`statusName.${item.status}`)}
              </Badge>,
              item.lastUsedAt ? dateTime(item.lastUsedAt) : t("neverUsed"),
            ])}
          />
        </Panel>
      )}
      {open === "new" ? (
        <AddSheet mutation={mutation} onClose={() => setOpen(undefined)} tenantId={tenantId} />
      ) : null}
      {selected ? (
        <SourceSheet
          key={selected.id}
          mutation={mutation}
          onClose={() => setOpen(undefined)}
          source={selected}
          tenantId={tenantId}
        />
      ) : null}
    </>
  );
}
