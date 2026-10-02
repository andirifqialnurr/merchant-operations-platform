"use client";

import { type ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@merchant/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@merchant/ui/feedback";

import { useLogout, useSession } from "@/features/auth";
import { useWorkspaces, WorkspaceProvider } from "@/features/workspace";
import { ApiClientError } from "@/lib/api-client";
import { ToastProvider } from "@/providers/toast-provider";
import { BackofficeShell } from "@/shell/backoffice-shell";
import { shellMessages as t } from "@/shell/messages";

function Centered({ children }: Readonly<{ children: ReactNode }>) {
  return <main className="grid min-h-dvh place-items-center bg-canvas p-6">{children}</main>;
}

export default function BackofficeLayout({ children }: Readonly<{ children: ReactNode }>) {
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
              {t.retry}
            </Button>
          }
          description={failure?.message ?? ""}
          title={t.loadFailed}
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
              {t.signOut}
            </Button>
          }
          description={t.noWorkspace}
          title={t.noWorkspaceTitle}
        />
      </Centered>
    );
  }

  return (
    <WorkspaceProvider workspaces={workspaces.data}>
      <ToastProvider dismissLabel={t.dismissToast}>
        <BackofficeShell onSignOut={signOut} user={session.data.user}>
          {children}
        </BackofficeShell>
      </ToastProvider>
    </WorkspaceProvider>
  );
}
