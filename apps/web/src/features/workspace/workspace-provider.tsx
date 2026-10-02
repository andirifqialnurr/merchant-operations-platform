"use client";

import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PermissionKey, WorkspaceContext } from "@merchant/contracts";

import { merchantApi } from "@/lib/api-client";

const STORAGE_KEY = "merchant-operations-context";

export const workspacesKey = ["access", "workspaces"] as const;

/** Only runs once a session exists, so signed-out visitors do not trigger a 401. */
export function useWorkspaces(enabled: boolean) {
  return useQuery({ enabled, queryFn: merchantApi.workspaces, queryKey: workspacesKey });
}

type Selection = { outletId?: string; tenantId?: string };
type WorkspaceValue = {
  can: (permission: PermissionKey) => boolean;
  /** Active location, or undefined when the user has none assigned in this workspace. */
  outlet: WorkspaceContext["outlets"][number] | undefined;
  setOutletId: (id: string) => void;
  setTenantId: (id: string) => void;
  workspace: WorkspaceContext;
  workspaces: readonly WorkspaceContext[];
};

const WorkspaceContextValue = createContext<WorkspaceValue | null>(null);

function readStored(): Selection {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Selection;
  } catch {
    return {};
  }
}

/**
 * Holds the active workspace and location. The selection only chooses context;
 * the API proves membership and scope on every request.
 */
export function WorkspaceProvider({
  children,
  workspaces,
}: Readonly<{ children: ReactNode; workspaces: readonly WorkspaceContext[] }>) {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<Selection>({});

  useEffect(() => {
    // Restore after mount so the server render and first client render agree.
    const timer = window.setTimeout(() => setSelection(readStored()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const value = useMemo<WorkspaceValue>(() => {
    const workspace =
      workspaces.find((item) => item.tenant.id === selection.tenantId) ?? workspaces[0]!;
    const outlet =
      workspace.outlets.find((item) => item.id === selection.outletId) ?? workspace.outlets[0];

    function store(next: Selection) {
      setSelection(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage can be unavailable; the selection still works for this visit.
      }
    }

    return {
      can: (permission) => workspace.permissionKeys.includes(permission),
      outlet,
      setOutletId: (id) => store({ outletId: id, tenantId: workspace.tenant.id }),
      setTenantId: (id) => {
        // Never show one workspace's cached data under another.
        queryClient.removeQueries({
          predicate: (query) => query.queryKey[0] !== "auth" && query.queryKey[0] !== "access",
        });
        store({ tenantId: id });
      },
      workspace,
      workspaces,
    };
  }, [queryClient, selection, workspaces]);

  return <WorkspaceContextValue.Provider value={value}>{children}</WorkspaceContextValue.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContextValue);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return value;
}
