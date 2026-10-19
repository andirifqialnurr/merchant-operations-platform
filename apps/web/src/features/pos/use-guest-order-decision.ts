"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { merchantApi } from "@/lib/api-client";
import { useErrorMessage } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";

import type { GuestOrderDecision } from "./visit-orders";

export function useGuestOrderDecision(tenantId: string, outletId: string) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const errorMessage = useErrorMessage();
  const t = useTranslations("floor");
  return useMutation({
    mutationFn: (input: GuestOrderDecision) =>
      input.decision === "accept"
        ? merchantApi.acceptGuestOrder(tenantId, outletId, input.orderId)
        : merchantApi.rejectGuestOrder(tenantId, outletId, input.orderId, input.reason),
    onSuccess: (_result, input) =>
      notify({
        message: t(input.decision === "accept" ? "guestOrderAccepted" : "guestOrderRejected"),
        tone: "success",
      }),
    onError: (error) => notify({ message: errorMessage(error), tone: "danger" }),
    // Both success and conflicts reload authoritative decisions/tile counts. No optimistic debt/KDS state.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["floor", tenantId, outletId] }),
  });
}
