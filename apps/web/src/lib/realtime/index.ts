"use client";

import { io, type Socket } from "socket.io-client";

import { REALTIME_PATH } from "@merchant/contracts";

/**
 * Opens a realtime connection to one namespace through the web app's own
 * origin, as REST goes, so the browser sends the same cookies. Socket.IO
 * connects again by itself after a network failure.
 */
export function openRealtime(namespace: string, auth: Record<string, string>): Socket {
  return io(namespace, {
    addTrailingSlash: false,
    auth,
    path: REALTIME_PATH,
    withCredentials: true,
  });
}

/**
 * The reason the server gave for refusing the connection. Undefined when the
 * network failed instead; only then does trying again help.
 */
export function refusalReason(error: Error): string | undefined {
  const data = (error as Error & { data?: { reason?: unknown } }).data;
  return typeof data?.reason === "string" ? data.reason : undefined;
}
