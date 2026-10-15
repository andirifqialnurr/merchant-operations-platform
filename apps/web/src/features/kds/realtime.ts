"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { KDS_REALTIME, kitchenQueueChangedSchema } from "@merchant/contracts";

import { openRealtime, refusalReason } from "@/lib/realtime";

import { kitchenKeys } from "./api";

/**
 * How the screen hears about changes.
 * - `connecting`: the first attempt is under way.
 * - `live`: the server tells it at once.
 * - `polling`: the server will not tell this screen (it is not a registered
 *   kitchen screen), so it reads the queue every few seconds.
 * - `reconnecting`: the link dropped; reading every few seconds meanwhile.
 * - `offline`: the device has no network.
 */
export type QueueLink = "connecting" | "live" | "offline" | "polling" | "reconnecting";

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return online;
}

/**
 * Follows the outlet's queue over realtime. Every message, and every
 * (re)connection, makes the screen read the queue again over REST: the
 * message itself carries nothing to show.
 */
export function useQueueLink(tenantId: string, outletId: string): QueueLink {
  const queryClient = useQueryClient();
  const online = useOnline();
  const [link, setLink] = useState<Exclude<QueueLink, "offline">>("connecting");

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: kitchenKeys.queue(tenantId, outletId) });
      void queryClient.invalidateQueries({ queryKey: kitchenKeys.finished(tenantId, outletId) });
    };
    const socket = openRealtime(KDS_REALTIME.namespace, { outletId, tenantId });
    socket.on("connect", () => {
      setLink("live");
      // Whatever happened while the link was down.
      refresh();
    });
    socket.on("disconnect", () => setLink(socket.active ? "reconnecting" : "polling"));
    socket.on("connect_error", (error) => {
      // A refusal is final for this screen; a network failure is retried.
      setLink(refusalReason(error) ? "polling" : "reconnecting");
    });
    socket.on(KDS_REALTIME.queueChanged, (message: unknown) => {
      if (kitchenQueueChangedSchema.safeParse(message).data?.outletId === outletId) refresh();
    });
    return () => {
      socket.disconnect();
    };
  }, [outletId, queryClient, tenantId]);

  return online ? link : "offline";
}
