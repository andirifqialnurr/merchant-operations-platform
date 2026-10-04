"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AcceptInvitation,
  AuthLoginRequest,
  UpdateUserPreferences,
} from "@merchant/contracts";

import { merchantApi } from "@/lib/api-client";

export const sessionKey = ["auth", "session"] as const;

export function useSession() {
  return useQuery({ queryFn: merchantApi.session, queryKey: sessionKey });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AuthLoginRequest) => merchantApi.login(input),
    onSuccess: (session) => {
      queryClient.clear();
      queryClient.setQueryData(sessionKey, session);
    },
  });
}

/**
 * Saves a language or theme choice to the user's profile. The screen has
 * already switched; a failed save only means the choice is not remembered on
 * other devices, so it is not reported.
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserPreferences) => merchantApi.updatePreferences(input),
    onSuccess: (session) => queryClient.setQueryData(sessionKey, session),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: merchantApi.logout,
    // Drop every cached workspace's data so nothing leaks into the next session.
    onSettled: () => queryClient.clear(),
  });
}

/** What an invitation link is for; asked once per link. */
export function useInvitationPreview(token: string | undefined) {
  return useQuery({
    enabled: Boolean(token),
    queryFn: () => merchantApi.invitationPreview(token ?? ""),
    queryKey: ["invitation", "preview", token],
    retry: false,
    staleTime: Infinity,
  });
}

/**
 * Accepts an invitation. Someone who just created their account is signed in
 * right away with the password they chose; someone with an existing account
 * signs in themselves afterwards.
 */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, input }: { email: string; input: AcceptInvitation }) => {
      await merchantApi.acceptInvitation(input);
      if (!input.password) return { workspaces: undefined };
      // A sign-in that was open belongs to someone else; the new account replaces it.
      await merchantApi.logout().catch(() => undefined);
      const session = await merchantApi.login({ email, password: input.password });
      queryClient.clear();
      queryClient.setQueryData(sessionKey, session);
      return { workspaces: await merchantApi.workspaces() };
    },
  });
}
