"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState, useSyncExternalStore } from "react";

import { invitationTokenSchema, PERMISSIONS, type WorkspaceContext } from "@merchant/contracts";
import { Button } from "@merchant/ui/button";
import { DescriptionList } from "@merchant/ui/data-display";
import { Alert, ErrorState, Skeleton } from "@merchant/ui/feedback";
import { FormField, Input } from "@merchant/ui/form-field";

import { useErrorMessage } from "@/lib/i18n";

import { useAcceptInvitation, useInvitationPreview } from "./api";

/**
 * Where a person who just joined starts: the cashier screen for someone who
 * sells and does not manage the catalog, the backoffice for everyone else.
 */
export function startPathFor(workspaces: readonly WorkspaceContext[]) {
  const permissions = workspaces[0]?.permissionKeys ?? [];
  const sells = permissions.includes(PERMISSIONS.orderCreate);
  return sells && !permissions.includes(PERMISSIONS.catalogRead) ? "/pos" : "/catalog";
}

// The secret is kept here once read, because it is removed from the address right after.
let linkToken: string | null = null;

/**
 * The secret from the link. It sits in the fragment, which is never sent to a
 * server. A newer link opened in the same tab replaces the one read before.
 */
function readToken() {
  const value = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
  const parsed = invitationTokenSchema.safeParse(value);
  if (parsed.success) linkToken = parsed.data;
  return linkToken;
}

/** Opening another link in the same tab only changes the fragment. */
function onLinkChange(notify: () => void) {
  window.addEventListener("hashchange", notify);
  return () => window.removeEventListener("hashchange", notify);
}

/**
 * The page an invitation link opens: who invites, which email is invited,
 * and, for someone without an account, a name and a password to create one.
 */
export function InviteForm({
  onJoined,
  onSignIn,
}: Readonly<{
  /** Signed in as the new account; the path is where their work starts. */
  onJoined: (path: string) => void;
  /** The person has an account already and signs in with it. */
  onSignIn: () => void;
}>) {
  const t = useTranslations("invite");
  const errorMessage = useErrorMessage();
  // undefined: not read yet (on the server); null: the link carries no usable secret.
  const token = useSyncExternalStore(onLinkChange, readToken, () => undefined);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; password?: string }>({});
  const preview = useInvitationPreview(token ?? undefined);
  const accept = useAcceptInvitation();

  useEffect(() => {
    // Once read, the secret leaves the address bar and the browser history.
    if (token && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [token]);

  if (token === undefined || (token && preview.isPending)) {
    return <Skeleton variant="metric-card" />;
  }
  if (token === null || preview.isError || !preview.data) {
    return (
      <ErrorState
        description={preview.isError ? errorMessage(preview.error) : t("invalidLink")}
        title={t("invalidTitle")}
      />
    );
  }

  const invitation = preview.data;
  const needsAccount = !invitation.accountExists;

  if (accept.isSuccess && !needsAccount) {
    return (
      <div className="grid gap-4">
        <h1 className="text-heading-lg">{t("joinedTitle")}</h1>
        <p className="m-0 text-label text-foreground-secondary">
          {t("joinedDescription", { workspace: invitation.workspaceName })}
        </p>
        <Button fullWidth onClick={onSignIn} size="lg">
          {t("signIn")}
        </Button>
      </div>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    const next = needsAccount
      ? {
          ...(displayName.trim().length < 2 ? { name: t("nameRequired") } : {}),
          ...(password.length < 8 ? { password: t("passwordRequired") } : {}),
        }
      : {};
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    accept.mutate(
      {
        email: invitation.email,
        input: needsAccount ? { displayName: displayName.trim(), password, token } : { token },
      },
      {
        onSuccess: (result) =>
          result.workspaces ? onJoined(startPathFor(result.workspaces)) : undefined,
      },
    );
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={submit}>
      <h1 className="text-heading-lg">{t("title")}</h1>
      {accept.error ? (
        <Alert title={t("failed")} tone="danger">
          {errorMessage(accept.error)}
        </Alert>
      ) : null}
      <DescriptionList
        items={[
          { label: t("workspace"), value: invitation.workspaceName },
          { label: t("email"), value: invitation.email },
        ]}
      />
      {needsAccount ? (
        <>
          <FormField
            {...(errors.name ? { error: errors.name } : {})}
            htmlFor="invite-name"
            label={t("name")}
          >
            <Input
              autoComplete="name"
              id="invite-name"
              onChange={(event) => setDisplayName(event.target.value)}
              size="lg"
              value={displayName}
            />
          </FormField>
          <FormField
            {...(errors.password ? { error: errors.password } : {})}
            helperText={t("passwordHint")}
            htmlFor="invite-password"
            label={t("password")}
          >
            <Input
              autoComplete="new-password"
              hidePasswordLabel={t("hidePassword")}
              id="invite-password"
              onChange={(event) => setPassword(event.target.value)}
              showPasswordLabel={t("showPassword")}
              size="lg"
              value={password}
              variant="password"
            />
          </FormField>
        </>
      ) : (
        <p className="m-0 text-label text-foreground-secondary">{t("existingAccount")}</p>
      )}
      <Button
        fullWidth
        loading={accept.isPending}
        loadingLabel={t("joining")}
        size="lg"
        type="submit"
      >
        {needsAccount ? t("createAndJoin") : t("join")}
      </Button>
    </form>
  );
}
