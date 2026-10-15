import pg from "pg";

/** How long to wait before connecting again after the connection was lost. */
const RECONNECT_DELAY_MS = 2_000;

export type ChannelListener = {
  /** Stops listening and closes the connection. */
  close(): Promise<void>;
};

/**
 * Receives PostgreSQL notifications on one channel over a connection of its
 * own, outside Prisma's pool. A lost connection is opened again; messages
 * sent while it was down are lost, so a receiver must treat them as hints
 * and read the truth from the tables. `onConnected` runs after every
 * (re)connection, which is when such a receiver catches up.
 */
export function listenToChannel(
  channel: string,
  onMessage: (payload: string) => void,
  options: {
    connectionString?: string;
    onConnected?: () => void;
    onError?: (error: unknown) => void;
  } = {},
): ChannelListener {
  if (!/^[a-z_]+$/.test(channel)) throw new Error(`Invalid channel name: ${channel}`);
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL wajib tersedia sebelum mendengarkan notifikasi.");
  }
  let client: pg.Client | undefined;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const scheduleReconnect = () => {
    if (closed || retry) return;
    retry = setTimeout(() => {
      retry = undefined;
      void connect();
    }, RECONNECT_DELAY_MS);
  };

  const connect = async () => {
    const next = new pg.Client({ connectionString });
    next.on("notification", (message) => {
      if (message.channel === channel && message.payload) onMessage(message.payload);
    });
    next.on("error", (error) => {
      options.onError?.(error);
      void next.end().catch(() => undefined);
    });
    next.on("end", () => {
      if (client === next) client = undefined;
      scheduleReconnect();
    });
    try {
      await next.connect();
      await next.query(`LISTEN ${channel}`);
      if (closed) {
        await next.end();
        return;
      }
      client = next;
      options.onConnected?.();
    } catch (error) {
      options.onError?.(error);
      await next.end().catch(() => undefined);
    }
  };

  void connect();
  return {
    async close() {
      closed = true;
      if (retry) clearTimeout(retry);
      await client?.end().catch(() => undefined);
    },
  };
}
