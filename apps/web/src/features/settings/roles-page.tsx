"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { IconPlus } from "@tabler/icons-react";

import { PERMISSIONS, type PermissionKey, type Role } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { DataTable, Panel } from "@merchant/ui/data-display";
import { Badge, EmptyState, Skeleton } from "@merchant/ui/feedback";
import { FormField, Input } from "@merchant/ui/form-field";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { Tabs } from "@merchant/ui/navigation";
import { AlertDialog, Sheet } from "@merchant/ui/overlay";
import { PageHeader } from "@merchant/ui/page";
import { PermissionMatrix } from "@merchant/ui/permission-matrix";
import { Checkbox } from "@merchant/ui/selection-control";

import { useWorkspace } from "@/features/workspace";
import { type ApiClientError, merchantApi } from "@/lib/api-client";
import { isLimitReached, LimitReachedState } from "@/shell/limit-reached-state";
import { RequestErrorState } from "@/shell/request-error-state";

import { usePeopleMutation, useRoles, type PeopleMutation } from "./api";
import { PERMISSION_GROUPS, roleCodeFromName } from "./permission-groups";

/** The name of a role: translated for the ones every business starts with. */
function useRoleName() {
  const t = useTranslations("users");
  return (role: Role) =>
    role.isSystem && t.has(`roleName.${role.code}` as never)
      ? t(`roleName.${role.code}` as never)
      : role.name;
}

function RoleSheet({
  canManage,
  mutation,
  onClose,
  role,
  tenantId,
}: Readonly<{
  canManage: boolean;
  mutation: PeopleMutation;
  onClose: () => void;
  /** Undefined while a new role is being made. */
  role: Role | undefined;
  tenantId: string;
}>) {
  const t = useTranslations("roles");
  const roleName = useRoleName();
  const { can } = useWorkspace();
  const [name, setName] = useState(role?.name ?? "");
  const [granted, setGranted] = useState<ReadonlySet<PermissionKey>>(
    new Set(role?.permissionKeys ?? []),
  );
  const [errors, setErrors] = useState<{ name?: string; permissions?: string }>({});
  const [limitError, setLimitError] = useState<ApiClientError>();
  const [confirming, setConfirming] = useState(false);
  // The roles every business starts with are the same everywhere and cannot be changed.
  const editable = canManage && !role?.isSystem;
  const busy = mutation.isPending;

  function toggle(permission: PermissionKey, on: boolean) {
    setGranted((current) => {
      const next = new Set(current);
      if (on) next.add(permission);
      else next.delete(permission);
      return next;
    });
    setErrors((current) => ({ ...(current.name ? { name: current.name } : {}) }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = {
      ...(roleCodeFromName(name).length < 2 ? { name: t("nameRequired") } : {}),
      ...(granted.size === 0 ? { permissions: t("permissionRequired") } : {}),
    };
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const fields = { name: name.trim(), permissionKeys: [...granted] };
    mutation.mutate(
      role
        ? { action: () => merchantApi.updateRole(tenantId, role.id, fields), success: t("saved") }
        : {
            action: () =>
              merchantApi.createRole(tenantId, { ...fields, code: roleCodeFromName(name) }),
            success: t("created"),
          },
      {
        onError: (error) => setLimitError(isLimitReached(error) ? error : undefined),
        onSuccess: onClose,
      },
    );
  }

  return (
    <>
      <Sheet
        closeLabel={t("closeSheet")}
        footer={
          editable && !limitError ? (
            <>
              {role ? (
                <Button
                  disabled={busy}
                  onClick={() =>
                    role.status === "ACTIVE"
                      ? setConfirming(true)
                      : mutation.mutate(
                          {
                            action: () =>
                              merchantApi.updateRole(tenantId, role.id, { status: "ACTIVE" }),
                            success: t("activated"),
                          },
                          { onSuccess: onClose },
                        )
                  }
                  variant="secondary"
                >
                  {role.status === "ACTIVE" ? t("deactivate") : t("activate")}
                </Button>
              ) : null}
              <Button form="role-form" loading={busy} loadingLabel={t("saving")} type="submit">
                {t("save")}
              </Button>
            </>
          ) : undefined
        }
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        open
        title={role ? roleName(role) : t("newRole")}
      >
        {limitError ? (
          <LimitReachedState error={limitError} />
        ) : (
          <form className="grid gap-6" id="role-form" noValidate onSubmit={submit}>
            {role?.isSystem ? (
              <p className="m-0 text-label text-foreground-secondary">{t("systemNote")}</p>
            ) : (
              <FormField
                {...(errors.name ? { error: errors.name } : {})}
                htmlFor="role-name"
                label={t("name")}
              >
                <Input
                  id="role-name"
                  onChange={(event) => {
                    setName(event.target.value);
                    setErrors((current) =>
                      current.permissions ? { permissions: current.permissions } : {},
                    );
                  }}
                  readOnly={!editable}
                  value={name}
                />
              </FormField>
            )}
            {errors.permissions ? (
              <p className="m-0 text-caption text-danger" role="alert">
                {errors.permissions}
              </p>
            ) : null}
            {PERMISSION_GROUPS.map((group) => (
              <fieldset className="m-0 grid gap-2 border-0 p-0" key={group.key}>
                <legend className="mb-1.5 p-0 text-label text-foreground">
                  {t(`group.${group.key}`)}
                </legend>
                {group.permissions.map((permission) => (
                  <Checkbox
                    checked={granted.has(permission)}
                    // Nobody hands out a permission they do not hold themselves.
                    disabled={!editable || !can(permission)}
                    key={permission}
                    label={t(`permission.${permission}` as never)}
                    onChange={(event) => toggle(permission, event.target.checked)}
                  />
                ))}
              </fieldset>
            ))}
          </form>
        )}
      </Sheet>
      {role ? (
        <AlertDialog
          cancelLabel={t("cancel")}
          closeLabel={t("closeSheet")}
          confirmLabel={t("deactivate")}
          onConfirm={() =>
            mutation.mutate(
              {
                action: () => merchantApi.updateRole(tenantId, role.id, { status: "INACTIVE" }),
                success: t("deactivated"),
              },
              { onSuccess: onClose },
            )
          }
          onOpenChange={setConfirming}
          open={confirming}
          title={t("deactivateTitle", { name: role.name })}
        >
          {t("deactivateDescription")}
        </AlertDialog>
      ) : null}
    </>
  );
}

/** Every active role side by side, to see at a glance who may do what. */
function RoleComparison({ roles }: Readonly<{ roles: readonly Role[] }>) {
  const t = useTranslations("roles");
  const roleName = useRoleName();
  const active = roles.filter((role) => role.status === "ACTIVE");
  return (
    <PermissionMatrix
      caption={t("comparisonCaption")}
      columns={active.map((role) => ({ key: role.id, label: roleName(role) }))}
      grantedLabel={t("granted")}
      groups={PERMISSION_GROUPS.map((group) => ({
        key: group.key,
        label: t(`group.${group.key}`),
        rows: group.permissions.map((permission) => ({
          granted: new Set(
            active
              .filter((role) => role.permissionKeys.includes(permission))
              .map((role) => role.id),
          ),
          key: permission,
          label: t(`permission.${permission}` as never),
        })),
      }))}
      notGrantedLabel={t("notGranted")}
      permissionLabel={t("permissions")}
    />
  );
}

export function RolesPage() {
  const t = useTranslations("roles");
  const roleName = useRoleName();
  const { can, workspace } = useWorkspace();
  const tenantId = workspace.tenant.id;
  // Roles belong to the whole business, not to one outlet.
  const canRead = can(PERMISSIONS.accessRoleRead) && workspace.allOutlets;
  const canManage = canRead && can(PERMISSIONS.accessRoleManage);
  const query = useRoles(tenantId, canRead);
  const mutation = usePeopleMutation(tenantId);
  const [open, setOpen] = useState<string>();
  const [view, setView] = useState<"compare" | "list">("list");

  if (!canRead) {
    return (
      <ModuleAccessState
        description={t("accessDenied")}
        reason="permission-denied"
        title={t("accessDeniedTitle")}
      />
    );
  }

  // The roles every business starts with first, then the business's own, by name.
  const roles = [...(query.data ?? [])].sort(
    (left, right) =>
      Number(right.isSystem) - Number(left.isSystem) ||
      roleName(left).localeCompare(roleName(right)),
  );
  const selected = roles.find((item) => item.id === open);

  return (
    <>
      <PageHeader
        {...(canManage
          ? {
              primaryAction: (
                <Button iconLeft={IconPlus} onClick={() => setOpen("new")}>
                  {t("createRole")}
                </Button>
              ),
            }
          : {})}
        tabs={
          <Tabs
            items={[
              { label: t("viewList"), value: "list" },
              { label: t("viewCompare"), value: "compare" },
            ]}
            label={t("views")}
            onValueChange={(value) => setView(value === "compare" ? "compare" : "list")}
            value={view}
          />
        }
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
      ) : view === "compare" ? (
        <Panel>
          <RoleComparison roles={roles} />
        </Panel>
      ) : (
        <Panel>
          <DataTable
            caption={t("title")}
            columns={[
              t("role"),
              { label: t("kind"), priority: 2 },
              { align: "end", label: t("permissions"), priority: 2 },
              t("status"),
            ]}
            empty={<EmptyState description={t("empty")} title={t("title")} />}
            onRowSelect={(index: number) => setOpen(roles[index]?.id)}
            rows={roles.map((item) => [
              roleName(item),
              item.isSystem ? t("kindSystem") : t("kindCustom"),
              t("permissionCount", { count: item.permissionKeys.length }),
              <Badge key="status" tone={item.status === "ACTIVE" ? "success" : "neutral"}>
                {t(`statusName.${item.status}`)}
              </Badge>,
            ])}
          />
        </Panel>
      )}
      {open === "new" && canManage ? (
        <RoleSheet
          canManage
          mutation={mutation}
          onClose={() => setOpen(undefined)}
          role={undefined}
          tenantId={tenantId}
        />
      ) : null}
      {selected ? (
        <RoleSheet
          canManage={canManage}
          key={selected.id}
          mutation={mutation}
          onClose={() => setOpen(undefined)}
          role={selected}
          tenantId={tenantId}
        />
      ) : null}
    </>
  );
}
