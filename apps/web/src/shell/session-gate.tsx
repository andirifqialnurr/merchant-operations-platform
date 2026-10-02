"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@merchant/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@merchant/ui/feedback";

import { useLogout, useSession } from "@/features/auth";
import { useWorkspaces, WorkspaceProvider } from "@/features/workspace";
import { ApiClientError } from "@/lib/api-client";
import { useErrorMessage } from "@/lib/i18n";
import { ToastProvider } from "@/providers/toast-provider";

import type { ShellUser } from "./shell-controls";

function Centered({ children }: Readonly<{ children: ReactNode }>) {
  return <main className="grid min-h-dvh place-items-center bg-canvas p-6">{children}</main>;
}

/**
 * Guards a signed-in surface: sends visitors without a session to the login
 * page, loads their workspaces, and only then renders the surface's shell.
 */
export function SessionGate({
  children,
  toastPlacement,
}: Readonly<{
  children: (context: { signOut: () => void; user: ShellUser }) => ReactNode;
  toastPlacement?: "top-center" | "top-right";
}>) {
  const t = useTranslations("shell");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const unauthenticated = session.error instanceof ApiClientError && session.error.status === 401;
  const workspaces = useWorkspaces(session.isSuccess);
  const logout = useLogout();

  useEffect(() => {
    if (unauthenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router, unauthenticated]);

  function signOut() {
    logout.mutate(undefined, { onSettled: () => router.replace("/login") });
  }

  if (unauthenticated || session.isPending || (session.isSuccess && workspaces.isPending)) {
    return (
      <Centered>
        <div className="w-full max-w-sm">
          <Skeleton variant="metric-card" />
        </div>
      </Centered>
    );
  }

  const failure = session.error ?? workspaces.error;
  if (failure || !session.data || !workspaces.data) {
    return (
      <Centered>
        <ErrorState
          action={
            <Button
              onClick={() => {
                void session.refetch();
                void workspaces.refetch();
              }}
              variant="secondary"
            >
              {t("retry")}
            </Button>
          }
          description={errorMessage(failure)}
          title={t("loadFailed")}
        />
      </Centered>
    );
  }

  if (workspaces.data.length === 0) {
    return (
      <Centered>
        <EmptyState
          action={
            <Button onClick={signOut} variant="secondary">
              {t("signOut")}
            </Button>
          }
          description={t("noWorkspace")}
          title={t("noWorkspaceTitle")}
        />
      </Centered>
    );
  }

  return (
    <WorkspaceProvider workspaces={workspaces.data}>
      <ToastProvider
        dismissLabel={t("dismissToast")}
        {...(toastPlacement ? { placement: toastPlacement } : {})}
      >
        {children({ signOut, user: session.data.user })}
      </ToastProvider>
    </WorkspaceProvider>
  );
}
