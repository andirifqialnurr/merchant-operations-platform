"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AuthLoginRequest } from "@merchant/contracts";

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

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: merchantApi.logout,
    // Drop every cached workspace's data so nothing leaks into the next session.
    onSettled: () => queryClient.clear(),
  });
}
