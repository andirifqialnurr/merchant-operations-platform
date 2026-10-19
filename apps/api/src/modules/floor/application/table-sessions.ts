import {
  computeCharges,
  isOrderApproved,
  MODULES,
  liveFloorSchema,
  tableSessionDetailSchema,
  tableSessionSchema,
  type CreateTableOrder,
  type UpdateFloorPolicy,
  type MoveTableSession,
  type OpenTableSession,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { BillingService } from "../../../kernels/billing-payment-ledger/public.js";
import { EntitlementService } from "../../../core/entitlements/public.js";
import { OrganizationService } from "../../../core/workspaces/public.js";
import { OrderIntakeService } from "../../../kernels/order-intake/public.js";
import type { ActorCommandOrigin, CommandOrigin } from "../../../shared/command/command-origin.js";
import { tableStatus } from "../domain/table-status.js";
import { FloorStructure } from "./floor-structure.js";
import {
  SERVICE_REQUEST_REPOSITORY,
  type ServiceRequestRepository,
} from "./service-request.repository.js";
import {
  TABLE_SESSION_REPOSITORY,
  TableTakenError,
  type TableSessionRecord,
  type TableSessionRepository,
} from "./table-session.repository.js";

export const toSession = (record: TableSessionRecord) =>
  tableSessionSchema.parse({
    displayNumber: record.displayNumber,
    guestCount: record.guestCount,
    id: record.id,
    openedAt: record.openedAt.toISOString(),
    status: record.status,
    tableIds: record.tableIds,
  });

/** Joining or splitting tables within one visit is a Pro capability. */
export const MERGE_TABLES_CAPABILITY = "floor.table_session.merge_split";

const notAvailable = () =>
  new ConflictException({
    code: "TABLE_NOT_AVAILABLE",
    message: "This table cannot take guests right now.",
  });

/**
 * Guests at tables: seating them, the cashier's live view of who sits
 * where, letting them go once everything is paid, and cleaning up after.
 */
@Injectable()
export class TableSessions {
  constructor(
    @Inject(TABLE_SESSION_REPOSITORY) private readonly sessions: TableSessionRepository,
    @Inject(FloorStructure) private readonly structure: FloorStructure,
    @Inject(OrderIntakeService) private readonly orders: OrderIntakeService,
    @Inject(BillingService) private readonly billing: BillingService,
    @Inject(OrganizationService) private readonly organization: OrganizationService,
    @Inject(EntitlementService) private readonly entitlements: EntitlementService,
    @Inject(SERVICE_REQUEST_REPOSITORY) private readonly requests: ServiceRequestRepository,
  ) {}

  /** Active floors and areas, every table with its status, and who holds them. */
  async live(tenantId: string, outletId: string) {
    const [floors, tables, policy, access, requests, claims, pending] = await Promise.all([
      this.structure.list(tenantId, outletId),
      this.sessions.live(tenantId, outletId),
      this.sessions.policy(tenantId, outletId),
      this.entitlements.describeAccess(tenantId, MODULES.tableSelfOrder),
      this.requests.openAt(tenantId, outletId),
      this.billing.verifyingClaims(tenantId, outletId),
      this.orders.pendingBySession(tenantId, outletId),
    ]);
    const shown = floors
      .filter((floor) => floor.status === "ACTIVE")
      .map((floor) => ({
        ...floor,
        areas: floor.areas.filter((area) => area.status === "ACTIVE"),
      }));
    const areaIds = new Set(shown.flatMap((floor) => floor.areas.map((area) => area.id)));
    const sessions = new Map<string, TableSessionRecord>();
    for (const table of tables) if (table.holder) sessions.set(table.holder.id, table.holder);
    return liveFloorSchema.parse({
      canMergeTables: access.capabilities.has(MERGE_TABLES_CAPABILITY),
      claims: claims.filter((claim) => sessions.has(claim.sessionId)),
      floors: shown,
      policy,
      requests: requests
        .filter((request) => sessions.has(request.sessionId))
        .map((request) => ({ ...request, requestedAt: request.requestedAt.toISOString() })),
      sessions: [...sessions.values()].map(toSession),
      tables: tables
        .filter((table) => areaIds.has(table.areaId))
        .map((table) => ({
          areaId: table.areaId,
          capacity: table.capacity,
          gridH: table.gridH,
          gridW: table.gridW,
          gridX: table.gridX,
          gridY: table.gridY,
          id: table.id,
          label: table.label,
          pendingOrderCount: table.holder ? (pending.get(table.holder.id) ?? 0) : 0,
          sessionId: table.holder?.id ?? null,
          shape: table.shape,
          status: tableStatus(table, table.holder),
        })),
    });
  }

  /** Staff came to the table or brought the bill: the request is done. */
  async finishRequest(tenantId: string, outletId: string, id: string, origin: ActorCommandOrigin) {
    const done = await this.requests.done(tenantId, outletId, id, new Date(), origin);
    if (!done) {
      throw new NotFoundException({
        code: "SERVICE_REQUEST_NOT_FOUND",
        message: "This request was already handled.",
      });
    }
  }

  async open(
    tenantId: string,
    outletId: string,
    input: OpenTableSession,
    origin: ActorCommandOrigin,
  ) {
    const table = await this.sessions.findTable(tenantId, outletId, input.tableId);
    if (!table) {
      throw new NotFoundException({
        code: "FLOOR_TABLE_NOT_FOUND",
        message: "Table was not found.",
      });
    }
    if (table.held || table.status !== "ACTIVE" || !table.areaActive || !table.floorActive) {
      throw notAvailable();
    }
    try {
      return toSession(await this.sessions.open(tenantId, outletId, input, origin));
    } catch (error) {
      // Someone else seated guests here a moment earlier.
      if (error instanceof TableTakenError) throw notAvailable();
      throw error;
    }
  }

  async get(tenantId: string, outletId: string, sessionId: string) {
    return toSession(await this.find(tenantId, outletId, sessionId));
  }

  /**
   * Moves the guests to a free table. The visit keeps its number, orders,
   * and bill; only the table it holds changes.
   */
  async move(
    tenantId: string,
    outletId: string,
    sessionId: string,
    input: MoveTableSession,
    origin: ActorCommandOrigin,
  ) {
    const session = await this.find(tenantId, outletId, sessionId);
    if (session.status === "CLOSED") {
      throw new ConflictException({
        code: "TABLE_SESSION_CLOSED",
        message: "This visit is already closed.",
      });
    }
    const table = await this.sessions.findTable(tenantId, outletId, input.tableId);
    if (!table) {
      throw new NotFoundException({
        code: "FLOOR_TABLE_NOT_FOUND",
        message: "Table was not found.",
      });
    }
    if (table.held || table.status !== "ACTIVE" || !table.areaActive || !table.floorActive) {
      throw notAvailable();
    }
    try {
      const moved = await this.sessions.move(tenantId, outletId, sessionId, input.tableId, origin);
      if (!moved) {
        throw new ConflictException({
          code: "TABLE_SESSION_CLOSED",
          message: "This visit is already closed.",
        });
      }
      return toSession(moved.session);
    } catch (error) {
      if (error instanceof TableTakenError) throw notAvailable();
      throw error;
    }
  }

  /** The visit with its orders, whether each is paid, and what is still owed. */
  async detail(tenantId: string, outletId: string, sessionId: string) {
    const session = await this.find(tenantId, outletId, sessionId);
    const orders = await this.orders.listBySession(tenantId, outletId, sessionId);
    const [paid, charges, tableLabel] = await Promise.all([
      this.billing.paidOrders(
        tenantId,
        orders.map((order) => order.id),
      ),
      this.organization.outletCharges(tenantId, outletId),
      this.sessions.primaryTableLabel(tenantId, outletId, sessionId),
    ]);
    const rows = orders.map((order) => {
      const settled = paid.get(order.id);
      return {
        createdAt: order.createdAt,
        id: order.id,
        lines: order.items.map((item) => ({
          name: item.variantName ? `${item.name} (${item.variantName})` : item.name,
          quantity: item.quantity,
          modifiers: item.modifiers.map((modifier) => modifier.optionName),
          note: item.note,
        })),
        note: order.note,
        orderNumber: order.orderNumber,
        paid: settled !== undefined,
        status: order.status,
        moderationStatus: order.moderationStatus,
        // What was paid stays; an unpaid order is priced with today's charges.
        totalMinor: (
          settled?.totalMinor ?? computeCharges(BigInt(order.subtotalMinor), charges).totalMinor
        ).toString(),
      };
    });
    const dueMinor = rows
      .filter((row) => !row.paid && row.status !== "CANCELED" && isOrderApproved(row))
      .reduce((sum, row) => sum + BigInt(row.totalMinor), 0n);
    return tableSessionDetailSchema.parse({
      dueMinor: dueMinor.toString(),
      orders: rows,
      session: toSession(session),
      tableLabel,
    });
  }

  /** Takes an order for the guests of an open visit; the kitchen hears of it like any order. */
  async addOrder(
    tenantId: string,
    outletId: string,
    sessionId: string,
    input: CreateTableOrder,
    idempotencyKey: string,
    origin: ActorCommandOrigin,
  ) {
    const session = await this.find(tenantId, outletId, sessionId);
    if (session.status === "CLOSED") {
      throw new ConflictException({
        code: "TABLE_SESSION_CLOSED",
        message: "This visit is already closed.",
      });
    }
    return this.orders.submitTableOrder(
      tenantId,
      outletId,
      sessionId,
      input,
      idempotencyKey,
      origin,
    );
  }

  /** The label of the table a visit sits at, for the kitchen's ticket. */
  async tableLabel(tenantId: string, outletId: string, sessionId: string) {
    return this.sessions.primaryTableLabel(tenantId, outletId, sessionId);
  }

  /**
   * Ends a visit once every order of it is paid or canceled. With the
   * outlet's cleaning policy the tables then wait to be cleaned.
   */
  async close(tenantId: string, outletId: string, sessionId: string, origin: ActorCommandOrigin) {
    const session = await this.find(tenantId, outletId, sessionId);
    if (session.status === "CLOSED") {
      throw new ConflictException({
        code: "TABLE_SESSION_CLOSED",
        message: "This visit is already closed.",
      });
    }
    const ensureSettled = async () => {
      const orders = (await this.orders.listBySession(tenantId, outletId, sessionId)).filter(
        (order) => order.status !== "CANCELED",
      );
      if (orders.some((order) => !isOrderApproved(order))) {
        throw new ConflictException({
          code: "SELF_ORDER_PENDING",
          message: "Decide pending orders before closing this visit.",
        });
      }
      const paid = await this.billing.paidOrders(
        tenantId,
        orders.map((order) => order.id),
      );
      const unpaid = orders.filter((order) => !paid.has(order.id));
      if (unpaid.length > 0)
        throw new ConflictException({
          code: "TABLE_SESSION_UNPAID",
          details: { orderNumbers: unpaid.map((order) => order.orderNumber) },
          message: "Every order of the visit must be paid or canceled first.",
        });
    };
    await ensureSettled();
    const policy = await this.sessions.policy(tenantId, outletId);
    const closed = await this.sessions.close(
      tenantId,
      outletId,
      sessionId,
      { needsCleaning: policy.cleaningAfterClose, now: new Date() },
      origin,
      ensureSettled,
    );
    if (!closed) {
      throw new ConflictException({
        code: "TABLE_SESSION_CLOSED",
        message: "This visit is already closed.",
      });
    }
    return toSession(closed);
  }

  /** Marks a table that waited to be cleaned as free again. */
  async clean(tenantId: string, outletId: string, tableId: string, origin: CommandOrigin) {
    const cleaned = await this.sessions.clean(tenantId, outletId, tableId, new Date(), origin);
    if (!cleaned) {
      throw new ConflictException({
        code: "TABLE_NOT_CLEANING",
        message: "This table is not waiting to be cleaned.",
      });
    }
  }

  policy(tenantId: string, outletId: string) {
    return this.sessions.policy(tenantId, outletId);
  }

  /** Changes what is given; the rest of the policy stays as it is. */
  async setPolicy(
    tenantId: string,
    outletId: string,
    change: UpdateFloorPolicy,
    origin: CommandOrigin,
  ) {
    const current = await this.sessions.policy(tenantId, outletId);
    return this.sessions.setPolicy(
      tenantId,
      outletId,
      {
        cleaningAfterClose: change.cleaningAfterClose ?? current.cleaningAfterClose,
        guestPaymentNote:
          change.guestPaymentNote === undefined
            ? current.guestPaymentNote
            : change.guestPaymentNote,
      },
      origin,
    );
  }

  private async find(tenantId: string, outletId: string, sessionId: string) {
    const session = await this.sessions.findSession(tenantId, outletId, sessionId);
    if (!session) {
      throw new NotFoundException({
        code: "TABLE_SESSION_NOT_FOUND",
        message: "This visit was not found.",
      });
    }
    return session;
  }
}
