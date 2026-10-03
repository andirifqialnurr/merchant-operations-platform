"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AuthLoginRequest, UpdateUserPreferences } from "@merchant/contracts";

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
