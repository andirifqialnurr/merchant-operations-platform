"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { IconPlus } from "@tabler/icons-react";

import {
  PERMISSIONS,
  type Device,
  type DeviceActivationTicket,
  type DeviceMode,
} from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { DataTable, DescriptionList, Panel } from "@merchant/ui/data-display";
import { DeviceStatusBadge } from "@merchant/ui/device-status";
import { EmptyState, Skeleton } from "@merchant/ui/feedback";
import { FormField, Input } from "@merchant/ui/form-field";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { AlertDialog, Sheet } from "@merchant/ui/overlay";
import { PageHeader } from "@merchant/ui/page";
import { Select } from "@merchant/ui/select";

import { useWorkspace } from "@/features/workspace";
import { type ApiClientError, merchantApi } from "@/lib/api-client";
import { useFormat } from "@/lib/i18n";
import { isLimitReached, LimitReachedState } from "@/shell/limit-reached-state";
import { RequestErrorState } from "@/shell/request-error-state";

import { useDeviceMutation, useDevices, type DeviceMutation } from "./api";

const MODES: readonly DeviceMode[] = ["POS", "KDS"];

/** The one moment the activation code is on screen. It is not kept anywhere. */
function ActivationCode({ ticket }: Readonly<{ ticket: DeviceActivationTicket }>) {
  const t = useTranslations("devices");
  const { time } = useFormat();
  const expiresAt = ticket.device.activationExpiresAt;
  return (
    <div className="grid gap-3">
      <p className="m-0 text-label text-foreground-secondary">{t("codeInstruction")}</p>
      <p
        aria-label={t("codeLabel")}
        className="m-0 font-mono text-heading-lg tracking-widest text-foreground"
      >
        {ticket.activationCode}
      </p>
      <p className="m-0 text-label text-foreground-secondary">
        {expiresAt ? t("codeValidUntil", { time: time(expiresAt) }) : null} {t("codeShownOnce")}
      </p>
    </div>
  );
}

function RegisterSheet({
  mutation,
  onClose,
  tenantId,
}: Readonly<{ mutation: DeviceMutation; onClose: () => void; tenantId: string }>) {
  const t = useTranslations("devices");
  const { workspace } = useWorkspace();
  const outlets = workspace.outlets.filter((item) => item.status === "ACTIVE");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<DeviceMode>("POS");
  const [outletId, setOutletId] = useState(outlets.length === 1 ? (outlets[0]?.id ?? "") : "");
  const [errors, setErrors] = useState<{ label?: string; outlet?: string }>({});
  const [ticket, setTicket] = useState<DeviceActivationTicket>();
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
        action: () => merchantApi.registerDevice(tenantId, { label: label.trim(), mode, outletId }),
        success: t("registered"),
      },
      {
        onError: (error) => setLimitError(isLimitReached(error) ? error : undefined),
        onSuccess: (result) => setTicket(result as DeviceActivationTicket),
      },
    );
  }

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      footer={
        ticket ? (
          <Button onClick={onClose}>{t("done")}</Button>
        ) : limitError ? undefined : (
          <Button
            form="device-form"
            loading={mutation.isPending}
            loadingLabel={t("saving")}
            type="submit"
          >
            {t("register")}
          </Button>
        )
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      size="sm"
      title={ticket ? ticket.device.label : t("newDevice")}
    >
      {ticket ? (
        <ActivationCode ticket={ticket} />
      ) : limitError ? (
        <LimitReachedState error={limitError} />
      ) : (
        <form className="grid gap-4" id="device-form" noValidate onSubmit={submit}>
          <FormField
            {...(errors.label ? { error: errors.label } : {})}
            htmlFor="device-label"
            label={t("label")}
          >
            <Input
              id="device-label"
              onChange={(event) => setLabel(event.target.value)}
              value={label}
            />
          </FormField>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            <span className="text-label">{t("mode")}</span>
            <Select
              emptyLabel={t("mode")}
              label={t("mode")}
              onValueChange={(value) => setMode(value as DeviceMode)}
              options={MODES.map((item) => ({ label: t(`modeName.${item}`), value: item }))}
              placeholder={t("mode")}
              value={mode}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            <span className="text-label">{t("outlet")}</span>
            <Select
              {...(errors.outlet ? { error: errors.outlet } : {})}
              {...(outletId ? { value: outletId } : {})}
              emptyLabel={t("noOutlet")}
              label={t("outlet")}
              onValueChange={setOutletId}
              options={outlets.map((item) => ({ label: item.name, value: item.id }))}
              placeholder={t("selectOutlet")}
            />
          </div>
        </form>
      )}
    </Sheet>
  );
}

function DeviceSheet({
  canManage,
  device,
  mutation,
  onClose,
  tenantId,
}: Readonly<{
  canManage: boolean;
  device: Device;
  mutation: DeviceMutation;
  onClose: () => void;
  tenantId: string;
}>) {
  const t = useTranslations("devices");
  const { dateTime, time } = useFormat();
  const { workspace } = useWorkspace();
  const outlet = workspace.outlets.find((item) => item.id === device.outletId);
  const [ticket, setTicket] = useState<DeviceActivationTicket>();
  const [confirming, setConfirming] = useState(false);
  const busy = mutation.isPending;

  // What the list does not already say about this device.
  const detail =
    device.status === "PENDING" && device.activationExpiresAt
      ? new Date(device.activationExpiresAt) > new Date()
        ? t("pendingUntil", { time: time(device.activationExpiresAt) })
        : t("pendingExpired")
      : device.status === "ACTIVE" && device.activatedAt
        ? t("activatedAt", { date: dateTime(device.activatedAt) })
        : device.revokedAt
          ? t("revokedAt", { date: dateTime(device.revokedAt) })
          : null;

  return (
    <>
      <Sheet
        closeLabel={t("closeSheet")}
        footer={
          ticket ? (
            <Button onClick={onClose}>{t("done")}</Button>
          ) : !canManage || device.status === "REVOKED" ? undefined : (
            <>
              {device.status === "PENDING" ? (
                <Button
                  disabled={busy}
                  onClick={() =>
                    mutation.mutate(
                      {
                        action: () => merchantApi.reissueDeviceCode(tenantId, device.id),
                        success: t("codeReissued"),
                      },
                      { onSuccess: (result) => setTicket(result as DeviceActivationTicket) },
                    )
                  }
                  variant="secondary"
                >
                  {t("newCode")}
                </Button>
              ) : null}
              <Button disabled={busy} onClick={() => setConfirming(true)} variant="destructive">
                {t("revoke")}
              </Button>
            </>
          )
        }
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        open
        size="sm"
        title={device.label}
      >
        {ticket ? (
          <ActivationCode ticket={ticket} />
        ) : (
          <div className="grid gap-5">
            <div className="wrap-anywhere md:hidden">
              <DescriptionList
                items={[
                  { label: t("mode"), value: t(`modeName.${device.mode}`) },
                  ...(outlet ? [{ label: t("outlet"), value: outlet.name }] : []),
                  {
                    label: t("lastSeen"),
                    value: device.lastSeenAt ? dateTime(device.lastSeenAt) : t("neverSeen"),
                  },
                ]}
              />
            </div>
            {detail ? <p className="m-0 text-label text-foreground-secondary">{detail}</p> : null}
          </div>
        )}
      </Sheet>
      <AlertDialog
        cancelLabel={t("cancel")}
        closeLabel={t("closeSheet")}
        confirmLabel={t("revoke")}
        onConfirm={() =>
          mutation.mutate(
            {
              action: () => merchantApi.revokeDevice(tenantId, device.id),
              success: t("revoked"),
            },
            { onSuccess: onClose },
          )
        }
        onOpenChange={setConfirming}
        open={confirming}
        title={t("revokeTitle", { label: device.label })}
      >
        {t("revokeDescription")}
      </AlertDialog>
    </>
  );
}

export function DevicesPage() {
  const t = useTranslations("devices");
  const { dateTime } = useFormat();
  const { can, workspace } = useWorkspace();
  const tenantId = workspace.tenant.id;
  // Devices belong to the whole business, not to one outlet.
  const canRead = can(PERMISSIONS.deviceRead) && workspace.allOutlets;
  const canManage = canRead && can(PERMISSIONS.deviceManage);
  const query = useDevices(tenantId, canRead);
  const mutation = useDeviceMutation(tenantId);
  const [open, setOpen] = useState<string>();

  if (!canRead) {
    return (
      <ModuleAccessState
        description={t("accessDenied")}
        reason="permission-denied"
        title={t("accessDeniedTitle")}
      />
    );
  }

  const devices = query.data?.devices ?? [];
  const selected = devices.find((item) => item.id === open);
  const outletName = (id: string) => workspace.outlets.find((item) => item.id === id)?.name ?? "";

  return (
    <>
      <PageHeader
        {...(canManage
          ? {
              primaryAction: (
                <Button iconLeft={IconPlus} onClick={() => setOpen("new")}>
                  {t("registerDevice")}
                </Button>
              ),
            }
          : {})}
        title={t("title")}
      />
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
        <Panel>
          <DataTable
            caption={t("title")}
            columns={[
              t("device"),
              { label: t("mode"), priority: 2 },
              { label: t("outlet"), priority: 2 },
              t("status"),
              { label: t("lastSeen"), priority: 3 },
            ]}
            empty={<EmptyState description={t("empty")} title={t("emptyTitle")} />}
            onRowSelect={(index: number) => setOpen(devices[index]?.id)}
            rows={devices.map((item) => [
              item.label,
              t(`modeName.${item.mode}`),
              outletName(item.outletId),
              <DeviceStatusBadge
                key="status"
                label={t(`statusName.${item.status}`)}
                status={item.status}
              />,
              item.lastSeenAt ? dateTime(item.lastSeenAt) : t("neverSeen"),
            ])}
          />
        </Panel>
      )}
      {canManage && open === "new" ? (
        <RegisterSheet mutation={mutation} onClose={() => setOpen(undefined)} tenantId={tenantId} />
      ) : null}
      {selected ? (
        <DeviceSheet
          canManage={canManage}
          device={selected}
          key={selected.id}
          mutation={mutation}
          onClose={() => setOpen(undefined)}
          tenantId={tenantId}
        />
      ) : null}
    </>
  );
}
