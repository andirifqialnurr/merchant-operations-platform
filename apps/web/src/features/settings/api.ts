"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { workspacesKey } from "@/features/workspace";
import { merchantApi } from "@/lib/api-client";
import { useErrorMessage } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";
import { isLimitReached } from "@/shell/limit-reached-state";

/** Every key carries the workspace so one workspace never reads another's cache. */
export const subscriptionKey = (tenantId: string) => ["subscription", tenantId] as const;

/** The workspace's package, its modules with tiers, and usage against limits. */
export function useSubscriptionOverview(tenantId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => merchantApi.subscription(tenantId),
    queryKey: subscriptionKey(tenantId),
  });
}

export const devicesKey = (tenantId: string) => ["devices", tenantId] as const;

export function useDevices(tenantId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => merchantApi.devices(tenantId),
    queryKey: devicesKey(tenantId),
  });
}

/**
 * Runs one device write, then refetches the list and the usage it counts
 * against. No optimistic update: the screen changes after the server confirms.
 */
export function useDeviceMutation(tenantId: string) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const errorMessage = useErrorMessage();
  return useMutation({
    mutationFn: ({ action }: { action: () => Promise<unknown>; success: string }) => action(),
    onError: (error) => {
      // A full limit is explained where the person tried to add, with what to do next.
      if (isLimitReached(error)) return;
      notify({ message: errorMessage(error), tone: "danger" });
    },
    onSuccess: async (_result, { success }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: devicesKey(tenantId) }),
        queryClient.invalidateQueries({ queryKey: subscriptionKey(tenantId) }),
      ]);
      notify({ message: success, tone: "success" });
    },
  });
}

export type DeviceMutation = ReturnType<typeof useDeviceMutation>;

export const peopleKeys = {
  invitations: (tenantId: string) => ["people", tenantId, "invitations"] as const,
  members: (tenantId: string) => ["people", tenantId, "members"] as const,
  roles: (tenantId: string) => ["people", tenantId, "roles"] as const,
};

export function useMembers(tenantId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => merchantApi.members(tenantId),
    queryKey: peopleKeys.members(tenantId),
  });
}

export function useInvitations(tenantId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => merchantApi.invitations(tenantId),
    queryKey: peopleKeys.invitations(tenantId),
  });
}

export function useRoles(tenantId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => merchantApi.roles(tenantId),
    queryKey: peopleKeys.roles(tenantId),
  });
}

/**
 * Runs one write about people, then refetches members, invitations, and the
 * usage they count against. The screen changes after the server confirms.
 */
export function usePeopleMutation(tenantId: string) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const errorMessage = useErrorMessage();
  return useMutation({
    mutationFn: ({ action }: { action: () => Promise<unknown>; success: string }) => action(),
    onError: (error) => {
      // A full limit is explained where the person tried to add, with what to do next.
      if (isLimitReached(error)) return;
      notify({ message: errorMessage(error), tone: "danger" });
    },
    onSuccess: async (_result, { success }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: peopleKeys.members(tenantId) }),
        queryClient.invalidateQueries({ queryKey: peopleKeys.invitations(tenantId) }),
        queryClient.invalidateQueries({ queryKey: peopleKeys.roles(tenantId) }),
        queryClient.invalidateQueries({ queryKey: subscriptionKey(tenantId) }),
      ]);
      notify({ message: success, tone: "success" });
    },
  });
}

export type PeopleMutation = ReturnType<typeof usePeopleMutation>;

export const organizationKey = (tenantId: string) => ["organization", tenantId] as const;

/** The business, its brands, and its outlets. */
export function useOrganization(tenantId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => merchantApi.organization(tenantId),
    queryKey: organizationKey(tenantId),
  });
}

/**
 * Runs one write to the structure of the business, then refetches it, the
 * usage it counts against, and the names shown in the shell.
 */
export function useOrganizationMutation(tenantId: string) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const errorMessage = useErrorMessage();
  return useMutation({
    mutationFn: ({ action }: { action: () => Promise<unknown>; success: string }) => action(),
    onError: (error) => {
      // A full limit is explained where the person tried to add, with what to do next.
      if (isLimitReached(error)) return;
      notify({ message: errorMessage(error), tone: "danger" });
    },
    onSuccess: async (_result, { success }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationKey(tenantId) }),
        queryClient.invalidateQueries({ queryKey: subscriptionKey(tenantId) }),
        queryClient.invalidateQueries({ queryKey: workspacesKey }),
      ]);
      notify({ message: success, tone: "success" });
    },
  });
}

export type OrganizationMutation = ReturnType<typeof useOrganizationMutation>;

export const integrationsKey = (tenantId: string) => ["integrations", tenantId] as const;

/** How the modules of the business pass data to each other. */
export function useIntegrations(tenantId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => merchantApi.integrations(tenantId),
    queryKey: integrationsKey(tenantId),
  });
}

/** Runs one write to an integration, then reads the list again. */
export function useIntegrationMutation(tenantId: string) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const errorMessage = useErrorMessage();
  return useMutation({
    mutationFn: ({ action }: { action: () => Promise<unknown>; success: string }) => action(),
    onError: (error) => notify({ message: errorMessage(error), tone: "danger" }),
    onSuccess: async (_result, { success }) => {
      await queryClient.invalidateQueries({ queryKey: integrationsKey(tenantId) });
      notify({ message: success, tone: "success" });
    },
  });
}
