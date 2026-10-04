"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { IconPlus } from "@tabler/icons-react";

import {
  invitationEmailSchema,
  PERMISSIONS,
  type Invitation,
  type Member,
  type Role,
} from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { DataTable, Panel } from "@merchant/ui/data-display";
import { Badge, EmptyState, type FeedbackTone, Skeleton } from "@merchant/ui/feedback";
import { FormField, Input } from "@merchant/ui/form-field";
import { ModuleAccessState } from "@merchant/ui/module-access-state";
import { Tabs } from "@merchant/ui/navigation";
import { AlertDialog, Sheet } from "@merchant/ui/overlay";
import { PageHeader } from "@merchant/ui/page";
import { Select } from "@merchant/ui/select";
import { Checkbox } from "@merchant/ui/selection-control";

import { useWorkspace } from "@/features/workspace";
import { type ApiClientError, merchantApi } from "@/lib/api-client";
import { useFormat } from "@/lib/i18n";
import { isLimitReached, LimitReachedState } from "@/shell/limit-reached-state";
import { RequestErrorState } from "@/shell/request-error-state";

import {
  useInvitations,
  useMembers,
  usePeopleMutation,
  useRoles,
  type PeopleMutation,
} from "./api";

type Tab = "invitations" | "members";

const invitationTone: Record<Invitation["status"], FeedbackTone> = {
  ACCEPTED: "success",
  EXPIRED: "neutral",
  PENDING: "warning",
  REVOKED: "neutral",
};

/** Names of roles and outlets for a member or an invitation, in the reader's language. */
function useGrantLabels(roles: readonly Role[]) {
  const t = useTranslations("users");
  const { workspace } = useWorkspace();
  const roleName = (role: Role) =>
    // The roles every business starts with have a translated name; custom ones keep their own.
    role.isSystem && t.has(`roleName.${role.code}` as never)
      ? t(`roleName.${role.code}` as never)
      : role.name;
  return {
    outlets: (grant: { allOutlets: boolean; outletIds: readonly string[] }) =>
      grant.allOutlets
        ? t("allOutlets")
        : grant.outletIds
            .map((id) => workspace.outlets.find((outlet) => outlet.id === id)?.name)
            .filter(Boolean)
            .join(", "),
    roleName,
    roles: (ids: readonly string[]) =>
      ids
        .map((id) => roles.find((role) => role.id === id))
        .filter((role): role is Role => Boolean(role))
        .map(roleName)
        .join(", "),
  };
}

function InviteSheet({
  mutation,
  onClose,
  roles,
  tenantId,
}: Readonly<{
  mutation: PeopleMutation;
  onClose: () => void;
  roles: readonly Role[];
  tenantId: string;
}>) {
  const t = useTranslations("users");
  const { workspace } = useWorkspace();
  const { roleName } = useGrantLabels(roles);
  const outlets = workspace.outlets.filter((item) => item.status === "ACTIVE");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [allOutlets, setAllOutlets] = useState(false);
  const [outletIds, setOutletIds] = useState<string[]>(
    outlets.length === 1 && outlets[0] ? [outlets[0].id] : [],
  );
  const [errors, setErrors] = useState<{ email?: string; outlets?: string; role?: string }>({});
  const [limitError, setLimitError] = useState<ApiClientError>();

  /** A message goes away as soon as the person works on that field again. */
  function clear(field: "email" | "outlets" | "role") {
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedEmail = invitationEmailSchema.safeParse(email);
    const next = {
      ...(parsedEmail.success ? {} : { email: t("emailRequired") }),
      ...(roleId ? {} : { role: t("roleRequired") }),
      ...(allOutlets || outletIds.length > 0 ? {} : { outlets: t("outletRequired") }),
    };
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsedEmail.success) return;
    mutation.mutate(
      {
        action: () =>
          merchantApi.createInvitation(tenantId, {
            allOutlets,
            email: parsedEmail.data,
            outletIds: allOutlets ? [] : outletIds,
            roleIds: [roleId],
          }),
        success: t("invited"),
      },
      {
        onError: (error) => setLimitError(isLimitReached(error) ? error : undefined),
        onSuccess: onClose,
      },
    );
  }

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      footer={
        limitError ? undefined : (
          <Button
            form="invite-form"
            loading={mutation.isPending}
            loadingLabel={t("sending")}
            type="submit"
          >
            {t("sendInvitation")}
          </Button>
        )
      }
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      size="sm"
      title={t("inviteTitle")}
    >
      {limitError ? (
        <LimitReachedState error={limitError} />
      ) : (
        <form className="grid gap-4" id="invite-form" noValidate onSubmit={submit}>
          <FormField
            {...(errors.email ? { error: errors.email } : {})}
            htmlFor="invite-email"
            label={t("email")}
          >
            <Input
              autoComplete="off"
              id="invite-email"
              inputMode="email"
              onChange={(event) => {
                setEmail(event.target.value);
                clear("email");
              }}
              value={email}
            />
          </FormField>
          <Select
            {...(errors.role ? { error: errors.role } : {})}
            {...(roleId ? { value: roleId } : {})}
            emptyLabel={t("noRoles")}
            label={t("role")}
            onValueChange={(value) => {
              setRoleId(value);
              clear("role");
            }}
            options={roles
              .filter((role) => role.status === "ACTIVE")
              .map((role) => ({ label: roleName(role), value: role.id }))}
            placeholder={t("selectRole")}
          />
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="mb-1.5 p-0 text-label">{t("outlets")}</legend>
            <Checkbox
              checked={allOutlets}
              label={t("allOutlets")}
              onChange={(event) => {
                setAllOutlets(event.target.checked);
                clear("outlets");
              }}
            />
            {allOutlets
              ? null
              : outlets.map((outlet) => (
                  <Checkbox
                    checked={outletIds.includes(outlet.id)}
                    key={outlet.id}
                    label={outlet.name}
                    onChange={(event) => {
                      setOutletIds((current) =>
                        event.target.checked
                          ? [...current, outlet.id]
                          : current.filter((id) => id !== outlet.id),
                      );
                      clear("outlets");
                    }}
                  />
                ))}
            {errors.outlets ? (
              <p className="m-0 text-caption text-danger" role="alert">
                {errors.outlets}
              </p>
            ) : null}
          </fieldset>
        </form>
      )}
    </Sheet>
  );
}

function MemberSheet({
  isSelf,
  member,
  mutation,
  onClose,
  tenantId,
}: Readonly<{
  isSelf: boolean;
  member: Member;
  mutation: PeopleMutation;
  onClose: () => void;
  tenantId: string;
}>) {
  const t = useTranslations("users");
  const [confirming, setConfirming] = useState(false);
  const busy = mutation.isPending;
  const active = member.status === "ACTIVE";

  return (
    <>
      <Sheet
        closeLabel={t("closeSheet")}
        footer={
          // Nobody takes away their own access; someone else has to.
          isSelf ? undefined : active ? (
            <>
              <Button
                disabled={busy}
                onClick={() =>
                  mutation.mutate({
                    action: () => merchantApi.revokeMemberSessions(tenantId, member.membershipId),
                    success: t("sessionsEnded"),
                  })
                }
                variant="secondary"
              >
                {t("endSessions")}
              </Button>
              <Button disabled={busy} onClick={() => setConfirming(true)} variant="destructive">
                {t("removeAccess")}
              </Button>
            </>
          ) : (
            <Button
              disabled={busy}
              onClick={() =>
                mutation.mutate(
                  {
                    action: () =>
                      merchantApi.updateMembership(tenantId, member.membershipId, {
                        status: "ACTIVE",
                      }),
                    success: t("accessRestored"),
                  },
                  { onSuccess: onClose },
                )
              }
              variant="secondary"
            >
              {t("restoreAccess")}
            </Button>
          )
        }
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        open
        size="sm"
        title={member.displayName}
      >
        <p className="m-0 text-label text-foreground-secondary">
          {isSelf ? t("selfNote") : active ? t("activeNote") : t("inactiveNote")}
        </p>
      </Sheet>
      <AlertDialog
        cancelLabel={t("cancel")}
        closeLabel={t("closeSheet")}
        confirmLabel={t("removeAccess")}
        onConfirm={() =>
          mutation.mutate(
            {
              action: () =>
                merchantApi.updateMembership(tenantId, member.membershipId, {
                  status: "INACTIVE",
                }),
              success: t("accessRemoved"),
            },
            { onSuccess: onClose },
          )
        }
        onOpenChange={setConfirming}
        open={confirming}
        title={t("removeTitle", { name: member.displayName })}
      >
        {t("removeDescription")}
      </AlertDialog>
    </>
  );
}

function InvitationSheet({
  invitation,
  mutation,
  onClose,
  tenantId,
}: Readonly<{
  invitation: Invitation;
  mutation: PeopleMutation;
  onClose: () => void;
  tenantId: string;
}>) {
  const t = useTranslations("users");
  const { dateTime } = useFormat();
  const busy = mutation.isPending;
  const open = invitation.status === "PENDING";

  return (
    <Sheet
      closeLabel={t("closeSheet")}
      footer={
        open ? (
          <>
            <Button
              disabled={busy}
              onClick={() =>
                mutation.mutate(
                  {
                    action: () => merchantApi.resendInvitation(tenantId, invitation.id),
                    success: t("resent"),
                  },
                  { onSuccess: onClose },
                )
              }
              variant="secondary"
            >
              {t("resend")}
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                mutation.mutate(
                  {
                    action: () => merchantApi.revokeInvitation(tenantId, invitation.id),
                    success: t("invitationWithdrawn"),
                  },
                  { onSuccess: onClose },
                )
              }
              variant="destructive"
            >
              {t("withdraw")}
            </Button>
          </>
        ) : undefined
      }
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      open
      size="sm"
      title={invitation.email}
    >
      <p className="m-0 text-label text-foreground-secondary">
        {open
          ? t("pendingNote", { date: dateTime(invitation.expiresAt) })
          : t(invitation.status === "REVOKED" ? "closedNote.REVOKED" : "closedNote.EXPIRED")}
      </p>
    </Sheet>
  );
}

export function UsersPage() {
  const t = useTranslations("users");
  const { dateTime } = useFormat();
  const { can, workspace } = useWorkspace();
  const tenantId = workspace.tenant.id;
  // People belong to the whole business, not to one outlet.
  const allowed = can(PERMISSIONS.accessMembershipManage) && workspace.allOutlets;
  const members = useMembers(tenantId, allowed);
  const invitations = useInvitations(tenantId, allowed);
  const roles = useRoles(tenantId, allowed && can(PERMISSIONS.accessRoleRead));
  const mutation = usePeopleMutation(tenantId);
  const labels = useGrantLabels(roles.data ?? []);
  const [tab, setTab] = useState<Tab>("members");
  const [open, setOpen] = useState<string>();

  if (!allowed) {
    return (
      <ModuleAccessState
        description={t("accessDenied")}
        reason="permission-denied"
        title={t("accessDeniedTitle")}
      />
    );
  }

  const failed = members.error ?? invitations.error ?? roles.error;
  const loading = members.isPending || invitations.isPending || roles.isPending;
  const memberRows = members.data?.members ?? [];
  // Accepted invitations are members by now; the list shows what still needs attention.
  const invitationRows = (invitations.data?.invitations ?? []).filter(
    (item) => item.status !== "ACCEPTED",
  );
  const selectedMember = memberRows.find((item) => item.membershipId === open);
  const selectedInvitation = invitationRows.find((item) => item.id === open);

  return (
    <>
      <PageHeader
        primaryAction={
          <Button iconLeft={IconPlus} onClick={() => setOpen("invite")}>
            {t("invite")}
          </Button>
        }
        tabs={
          <Tabs
            items={[
              { label: t("members"), value: "members" },
              { label: t("invitations"), value: "invitations" },
            ]}
            label={t("tabs")}
            onValueChange={(value) => setTab(value as Tab)}
            value={tab}
          />
        }
        title={t("title")}
      />
      {loading ? (
        <div className="grid gap-2">
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
          <Skeleton variant="table-row" />
        </div>
      ) : failed ? (
        <RequestErrorState
          error={failed}
          onRetry={() => {
            void members.refetch();
            void invitations.refetch();
            void roles.refetch();
          }}
          title={t("loadFailed")}
        />
      ) : tab === "members" ? (
        <Panel>
          <DataTable
            caption={t("members")}
            columns={[
              t("name"),
              { label: t("email"), priority: 2 },
              { label: t("role"), priority: 2 },
              { label: t("outlets"), priority: 3 },
              t("status"),
            ]}
            empty={<EmptyState description={t("emptyMembers")} title={t("members")} />}
            onRowSelect={(index: number) => setOpen(memberRows[index]?.membershipId)}
            rows={memberRows.map((item) => [
              item.displayName,
              item.email,
              labels.roles(item.roleIds),
              labels.outlets(item),
              <Badge key="status" tone={item.status === "ACTIVE" ? "success" : "neutral"}>
                {t(`memberStatus.${item.status}`)}
              </Badge>,
            ])}
          />
        </Panel>
      ) : (
        <Panel>
          <DataTable
            caption={t("invitations")}
            columns={[
              t("email"),
              { label: t("role"), priority: 2 },
              { label: t("outlets"), priority: 3 },
              t("status"),
              { label: t("validUntil"), priority: 2 },
            ]}
            empty={
              <EmptyState description={t("emptyInvitations")} title={t("emptyInvitationsTitle")} />
            }
            onRowSelect={(index: number) => setOpen(invitationRows[index]?.id)}
            rows={invitationRows.map((item) => [
              item.email,
              labels.roles(item.roleIds),
              labels.outlets(item),
              <Badge key="status" tone={invitationTone[item.status]}>
                {t(`invitationStatus.${item.status}`)}
              </Badge>,
              dateTime(item.expiresAt),
            ])}
          />
        </Panel>
      )}
      {open === "invite" ? (
        <InviteSheet
          mutation={mutation}
          onClose={() => setOpen(undefined)}
          roles={roles.data ?? []}
          tenantId={tenantId}
        />
      ) : null}
      {selectedMember ? (
        <MemberSheet
          isSelf={selectedMember.membershipId === workspace.membershipId}
          key={selectedMember.membershipId}
          member={selectedMember}
          mutation={mutation}
          onClose={() => setOpen(undefined)}
          tenantId={tenantId}
        />
      ) : null}
      {selectedInvitation ? (
        <InvitationSheet
          invitation={selectedInvitation}
          key={selectedInvitation.id}
          mutation={mutation}
          onClose={() => setOpen(undefined)}
          tenantId={tenantId}
        />
      ) : null}
    </>
  );
}
