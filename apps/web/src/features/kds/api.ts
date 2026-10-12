"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { KitchenTicket, KitchenTicketList, KitchenTicketStatus } from "@merchant/contracts";

import { ApiClientError, merchantApi } from "@/lib/api-client";
import { useErrorMessage } from "@/lib/i18n";
import { useToast } from "@/providers/toast-provider";

/** Keys carry the workspace and outlet so one kitchen never reads another's queue. */
export const kitchenKeys = {
  finished: (tenantId: string, outletId: string) =>
    ["kds", tenantId, "tickets", outletId, "finished"] as const,
  queue: (tenantId: string, outletId: string) =>
    ["kds", tenantId, "tickets", outletId, "queue"] as const,
};

/**
 * How often the queue is read again while nothing pushes changes to the
 * screen. A new ticket shows within this time.
 */
export const QUEUE_REFRESH_MS = 4000;

/** The outlet's tickets still being worked on, oldest first. */
export function useKitchenQueue(tenantId: string, outletId: string) {
  return useQuery({
    queryFn: () => merchantApi.kitchenTickets(tenantId, outletId),
    queryKey: kitchenKeys.queue(tenantId, outletId),
    refetchInterval: QUEUE_REFRESH_MS,
  });
}

/** Tickets served or canceled today, most recent first. Read when the view is opened. */
export function useFinishedTickets(tenantId: string, outletId: string, enabled: boolean) {
  return useQuery({
    enabled,
    queryFn: () => merchantApi.finishedKitchenTickets(tenantId, outletId),
    queryKey: kitchenKeys.finished(tenantId, outletId),
  });
}

/**
 * Moves a ticket one step on. The server's answer replaces the ticket on the
 * screen; a refusal reloads the queue, because the screen was out of date.
 */
export function useAdvanceTicket(tenantId: string, outletId: string) {
  const queryClient = useQueryClient();
  const errorMessage = useErrorMessage();
  const notify = useToast();
  const queueKey = kitchenKeys.queue(tenantId, outletId);

  return useMutation({
    mutationFn: (ticket: { id: string; status: KitchenTicketStatus }) =>
      merchantApi.advanceKitchenTicket(tenantId, outletId, ticket.id, {
        expectedStatus: ticket.status,
      }),
    onError: async (error) => {
      notify({ message: errorMessage(error), tone: "danger" });
      if (error instanceof ApiClientError)
        await queryClient.invalidateQueries({ queryKey: queueKey });
    },
    onSuccess: async (moved: KitchenTicket) => {
      queryClient.setQueryData<KitchenTicketList>(queueKey, (current) =>
        current
          ? {
              tickets: current.tickets
                .map((ticket) => (ticket.id === moved.id ? moved : ticket))
                // A served ticket leaves the queue.
                .filter((ticket) => ticket.status !== "SERVED" && ticket.status !== "CANCELED"),
            }
          : current,
      );
      await queryClient.invalidateQueries({
        queryKey: kitchenKeys.finished(tenantId, outletId),
      });
    },
  });
}
