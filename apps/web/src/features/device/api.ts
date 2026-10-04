"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { merchantApi } from "@/lib/api-client";

export const currentDeviceKey = ["device", "current"] as const;

/** The device this browser is activated as; null when it is not. */
export function useCurrentDevice() {
  return useQuery({ queryFn: merchantApi.currentDevice, queryKey: currentDeviceKey });
}

/**
 * Activates this browser as a device. A sign-in that was open before the
 * activation is ended, so that the next one is opened for the device: the
 * server binds a session to a device only when it is created on it.
 */
export function useActivateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const device = await merchantApi.activateDevice(code);
      // Nobody may be signed in; that is not an error here.
      await merchantApi.logout().catch(() => undefined);
      return device;
    },
    onSuccess: (device) => {
      queryClient.clear();
      queryClient.setQueryData(currentDeviceKey, device);
    },
  });
}
