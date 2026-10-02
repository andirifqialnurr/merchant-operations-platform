"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CloseRegisterSession,
  CurrentRegisterSession,
  OpenRegisterSession,
  RecordCashMovement,
} from "@merchant/contracts";

import { ApiClientError, merchantApi } from "@/lib/api-client";
import { useErrorMessage } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";

/** Keys carry the workspace and outlet so one outlet never reads another's shift. */
export const shiftKeys = {
  current: (tenantId: string, outletId: string) => ["pos", tenantId, "shift", outletId] as const,
};

/** Codes that mean the screen's picture of the shift is out of date. */
const STALE_SHIFT_CODES = new Set([
  "POS_SHIFT_ALREADY_OPEN",
  "POS_SHIFT_NOT_FOUND",
  "POS_SHIFT_NOT_OPEN",
]);

export function useCurrentShift(tenantId: string, outletId: string | undefined, enabled: boolean) {
  return useQuery({
    enabled: enabled && Boolean(outletId),
    queryFn: () => merchantApi.currentShift(tenantId, outletId ?? ""),
    queryKey: shiftKeys.current(tenantId, outletId ?? ""),
  });
}

/**
 * Shift writes for one outlet. Nothing is optimistic: the cache only takes the
 * shift the server returned, and a stale-shift error triggers a refetch.
 */
export function useShiftMutations(tenantId: string, outletId: string) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const errorMessage = useErrorMessage();
  const queryKey = shiftKeys.current(tenantId, outletId);

  const store = (value: CurrentRegisterSession) => queryClient.setQueryData(queryKey, value);
  const onError = (error: unknown) => {
    notify({ message: errorMessage(error), tone: "danger" });
    if (error instanceof ApiClientError && STALE_SHIFT_CODES.has(error.code)) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const open = useMutation({
    mutationFn: (input: OpenRegisterSession) => merchantApi.openShift(tenantId, outletId, input),
    onError,
    onSuccess: (session) => store({ session }),
  });
  const recordCash = useMutation({
    mutationFn: (variables: {
      idempotencyKey: string;
      input: RecordCashMovement;
      shiftId: string;
    }) =>
      merchantApi.recordCashMovement(
        tenantId,
        outletId,
        variables.shiftId,
        variables.input,
        variables.idempotencyKey,
      ),
    onError,
    onSuccess: (session) => store({ session }),
  });
  const close = useMutation({
    mutationFn: (variables: { input: CloseRegisterSession; shiftId: string }) =>
      merchantApi.closeShift(tenantId, outletId, variables.shiftId, variables.input),
    onError,
    onSuccess: () => store({ session: null }),
  });

  return { close, open, recordCash };
}
