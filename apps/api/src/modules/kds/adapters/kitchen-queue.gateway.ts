import {
  KDS_REALTIME,
  kitchenQueueChangedSchema,
  kitchenRealtimeScopeSchema,
  MODULES,
  PERMISSIONS,
  REALTIME_PATH,
  type KitchenQueueChanged,
  type KitchenRealtimeRefusal,
  type KitchenRealtimeScope,
} from "@merchant/contracts";
import { listenToChannel, type ChannelListener } from "@merchant/database/listen";
import { Inject, Logger, type OnModuleDestroy } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from "@nestjs/websockets";
import type { Namespace, Socket } from "socket.io";

import { SessionPermissionGuard } from "../../../core/memberships/public.js";

/** The database channel the kds_tickets trigger announces changes on. */
const QUEUE_CHANNEL = "kds_queue";

/** How often a connected screen's right to the queue is checked again. */
export const REAUTHORIZE_INTERVAL_MS = 60_000;

type ScreenData = { outletId: string; recheck?: ReturnType<typeof setInterval> };

function room(scope: KitchenRealtimeScope) {
  return `${scope.tenantId}:${scope.outletId}`;
}

function refusal(reason: KitchenRealtimeRefusal) {
  // Socket.IO hands `data` to the client's connect_error.
  return Object.assign(new Error(reason), { data: { reason } });
}

/** Browsers send an Origin; it must be the web app's. */
export function originAllowed(origin: string | undefined, webUrl = process.env.WEB_URL) {
  if (!origin || !webUrl) return true;
  try {
    return new URL(webUrl).origin === origin;
  } catch {
    return false;
  }
}

/**
 * Tells the kitchen screens of an outlet that its queue changed. Only a
 * session opened on a registered kitchen screen of that outlet, by someone who
 * may see the queue, can follow it (M3-SC-02). A message carries the outlet
 * and nothing else; the screen reads the queue again over REST.
 */
@WebSocketGateway({
  addTrailingSlash: false,
  cors: false,
  namespace: KDS_REALTIME.namespace,
  path: REALTIME_PATH,
  serveClient: false,
})
export class KitchenQueueGateway implements OnGatewayInit, OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(KitchenQueueGateway.name);
  private listener: ChannelListener | undefined;

  @WebSocketServer()
  private readonly namespace!: Namespace;

  constructor(@Inject(SessionPermissionGuard) private readonly access: SessionPermissionGuard) {}

  afterInit(namespace: Namespace) {
    namespace.use((socket, next) => {
      void this.admit(socket).then(
        () => next(),
        (error: unknown) =>
          next(error instanceof Error ? error : refusal("REALTIME_ACCESS_DENIED")),
      );
    });
    // Without a database (some tests) screens can still connect; they just
    // hear nothing and keep reading the queue on their own.
    if (!process.env.DATABASE_URL) {
      this.logger.warn("Kitchen queue listener not started: DATABASE_URL is not set.");
      return;
    }
    this.listener = listenToChannel(QUEUE_CHANNEL, (payload) => this.announce(payload), {
      // Changes made while the database connection was down were missed:
      // every screen reads its queue again.
      onConnected: () => {
        for (const socket of namespace.sockets.values()) {
          const { outletId } = socket.data as ScreenData;
          socket.emit(KDS_REALTIME.queueChanged, { outletId } satisfies KitchenQueueChanged);
        }
      },
      onError: (error) => this.logger.warn(`Kitchen queue listener: ${String(error)}`),
    });
  }

  handleDisconnect(socket: Socket) {
    const { recheck } = socket.data as ScreenData;
    if (recheck) clearInterval(recheck);
  }

  async onModuleDestroy() {
    await this.listener?.close();
  }

  /** Lets a screen in, or refuses it with a reason it can act on. */
  private async admit(socket: Socket) {
    if (!originAllowed(socket.handshake.headers.origin)) throw refusal("ORIGIN_NOT_ALLOWED");
    const scope = kitchenRealtimeScopeSchema.safeParse(socket.handshake.auth);
    if (!scope.success) throw refusal("REALTIME_ACCESS_DENIED");
    const cookie = socket.handshake.headers.cookie;
    const authorize = async () => {
      try {
        return await this.access.authorize(cookie, scope.data, {
          moduleKey: MODULES.kds,
          permission: PERMISSIONS.kdsTicketView,
        });
      } catch {
        throw refusal("REALTIME_ACCESS_DENIED");
      }
    };
    const { device } = await authorize();
    if (device?.mode !== "KDS") throw refusal("KDS_DEVICE_REQUIRED");

    // A revoked device, an ended session, or a lost role stops the updates.
    const recheck = setInterval(() => {
      void authorize().catch(() => socket.disconnect(true));
    }, REAUTHORIZE_INTERVAL_MS);
    recheck.unref();
    socket.data = { outletId: scope.data.outletId, recheck } satisfies ScreenData;
    await socket.join(room(scope.data));
  }

  private announce(payload: string) {
    // The trigger names the queue in the same shape a screen asks for it.
    let parsed: KitchenRealtimeScope;
    try {
      parsed = kitchenRealtimeScopeSchema.parse(JSON.parse(payload));
    } catch {
      return;
    }
    const message = kitchenQueueChangedSchema.parse({ outletId: parsed.outletId });
    this.namespace.to(room(parsed)).emit(KDS_REALTIME.queueChanged, message);
  }
}
