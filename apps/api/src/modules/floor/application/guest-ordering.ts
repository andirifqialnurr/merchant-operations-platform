import {
  computeCharges,
  guestMenuSchema,
  guestOrderSchema,
  guestVisitSchema,
  type GuestOrderStatus,
  type Order,
  type PlaceGuestOrder,
  type ServiceRequestType,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";

import {
  InMemoryRateLimitService,
  RATE_LIMIT_SERVICE,
  type RateLimitPolicy,
  type RateLimitService,
} from "../../../core/security/public.js";
import { OrganizationService } from "../../../core/workspaces/public.js";
import { BillingService } from "../../../kernels/billing-payment-ledger/public.js";
import { CatalogService } from "../../../kernels/catalog/public.js";
import { OrderIntakeService } from "../../../kernels/order-intake/public.js";
import { hashQrToken } from "../domain/qr-token.js";
import {
  SERVICE_REQUEST_REPOSITORY,
  type ServiceRequestRepository,
} from "./service-request.repository.js";
import { TableQrCodes } from "./table-qr-codes.js";
import type { QrTarget } from "./table-qr.repository.js";
import {
  TABLE_SESSION_REPOSITORY,
  TableTakenError,
  type TableSessionRecord,
  type TableSessionRepository,
} from "./table-session.repository.js";

/**
 * How often guests may order (M4-SC-02): per table QR, and per network
 * address, so one phone cannot flood a kitchen and many phones on one
 * network still can order normally.
 */
export const GUEST_ORDER_RATE_LIMITS = {
  address: { limit: 60, windowMs: 10 * 60_000 },
  table: { limit: 20, windowMs: 10 * 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;

/** Calling staff repeatedly does not call them faster; this stops a stuck button. */
export const GUEST_REQUEST_RATE_LIMIT = {
  limit: 10,
  windowMs: 10 * 60_000,
} as const satisfies RateLimitPolicy;

const GUEST_STATUS: Partial<Record<Order["status"], GuestOrderStatus>> = {
  ACCEPTED: "RECEIVED",
  CANCELED: "CANCELED",
  COMPLETED: "READY",
  PREPARING: "PREPARING",
  READY: "READY",
  SERVED: "READY",
  SUBMITTED: "RECEIVED",
};

function invalidQr() {
  return new NotFoundException({
    code: "TABLE_QR_INVALID",
    message: "This QR code does not lead to a table any more.",
  });
}

function closed() {
  return new ConflictException({
    code: "SELF_ORDER_CLOSED",
    message: "This table does not take orders from its QR right now.",
  });
}

/**
 * Guests ordering from a table's QR. Everything is keyed by the token in the
 * address; the answers carry names, numbers, and money only, never an id of
 * the table, the visit, or the business.
 */
@Injectable()
export class GuestOrdering {
  constructor(
    @Inject(TableQrCodes) private readonly codes: TableQrCodes,
    @Inject(TABLE_SESSION_REPOSITORY) private readonly sessions: TableSessionRepository,
    @Inject(OrderIntakeService) private readonly orders: OrderIntakeService,
    @Inject(BillingService) private readonly billing: BillingService,
    @Inject(CatalogService) private readonly catalog: CatalogService,
    @Inject(OrganizationService) private readonly organization: OrganizationService,
    @Inject(SERVICE_REQUEST_REPOSITORY) private readonly requests: ServiceRequestRepository,
    @Optional()
    @Inject(RATE_LIMIT_SERVICE)
    private readonly rateLimit: RateLimitService = new InMemoryRateLimitService(),
  ) {}

  /** What the outlet sells now, priced, with how tax and service are added. */
  async menu(token: string) {
    const target = await this.ready(token);
    const [menu, charges] = await Promise.all([
      this.catalog.getSellableMenu(target.tenantId, target.outletId),
      this.organization.outletCharges(target.tenantId, target.outletId),
    ]);
    return guestMenuSchema.parse({
      categories: menu.categories.map((category) => ({ id: category.id, name: category.name })),
      charges,
      currency: menu.products[0]?.currency ?? "IDR",
      products: menu.products.map((product) => ({
        categoryId: product.categoryId,
        id: product.id,
        modifierGroups: product.modifierGroups,
        name: product.name,
        priceMinor: product.priceMinor,
        variants: product.variants,
      })),
    });
  }

  /** The orders of the visit at the table now, and what is still to pay. */
  async visit(token: string) {
    const target = await this.resolve(token);
    const session = await this.sessions.holderOf(target.tenantId, target.outletId, target.tableId);
    if (!session || session.status === "CLOSED") {
      return guestVisitSchema.parse({ dueMinor: "0", orders: [], requests: [] });
    }
    return this.visitOf(target, session);
  }

  /**
   * Calls a waiter or asks for the bill for the visit at the table. Guests
   * who have not ordered yet have no visit to ask for, so they order first
   * or speak to staff.
   */
  async requestService(token: string, type: ServiceRequestType) {
    await this.rateLimit.consume(
      `self-order:request:${hashQrToken(token).slice(0, 32)}`,
      GUEST_REQUEST_RATE_LIMIT,
    );
    const target = await this.ready(token);
    const session = await this.sessions.holderOf(target.tenantId, target.outletId, target.tableId);
    if (!session || session.status !== "OPEN") {
      throw new ConflictException({
        code: "TABLE_VISIT_NOT_OPEN",
        message: "There is no visit at this table to ask staff for.",
      });
    }
    await this.requests.ask(target.tenantId, target.outletId, session.id, type, {
      channel: "WEB",
    });
    return this.visitOf(target, session);
  }

  /**
   * Places a guest's order on the table's visit, opening one when nobody
   * sits there yet. It reaches the kitchen like an order from the cashier.
   */
  async placeOrder(
    token: string,
    input: PlaceGuestOrder,
    idempotencyKey: string,
    address: string | undefined,
  ) {
    // Counted before anything else, refused or not.
    await this.rateLimit.consume(
      `self-order:table:${hashQrToken(token).slice(0, 32)}`,
      GUEST_ORDER_RATE_LIMITS.table,
    );
    await this.rateLimit.consume(
      `self-order:address:${address ?? "unknown"}`,
      GUEST_ORDER_RATE_LIMITS.address,
    );
    const target = await this.ready(token);
    const session = await this.seat(target, input.guestCount ?? 1);
    const order = await this.orders.submitTableOrder(
      target.tenantId,
      target.outletId,
      session.id,
      { items: input.items, ...(input.note ? { note: input.note } : {}) },
      idempotencyKey,
      { channel: "WEB" },
      "SELF_ORDER",
    );
    const charges = await this.organization.outletCharges(target.tenantId, target.outletId);
    return this.toGuestOrder(order, charges);
  }

  private async seat(target: QrTarget, guestCount: number) {
    const held = await this.sessions.holderOf(target.tenantId, target.outletId, target.tableId);
    if (held) {
      // Closed but waiting to be cleaned: the next guests wait too.
      if (held.status === "CLOSED") {
        throw new ConflictException({
          code: "TABLE_NOT_AVAILABLE",
          message: "This table is being prepared for the next guests.",
        });
      }
      return held;
    }
    try {
      return await this.sessions.open(
        target.tenantId,
        target.outletId,
        { guestCount, tableId: target.tableId },
        { channel: "WEB" },
      );
    } catch (error) {
      // Staff or another guest seated the table a moment earlier.
      if (!(error instanceof TableTakenError)) throw error;
      const now = await this.sessions.holderOf(target.tenantId, target.outletId, target.tableId);
      if (!now || now.status === "CLOSED") throw closed();
      return now;
    }
  }

  private async visitOf(target: QrTarget, session: TableSessionRecord) {
    const orders = await this.orders.listBySession(target.tenantId, target.outletId, session.id);
    const [paid, charges, requests] = await Promise.all([
      this.billing.paidOrders(
        target.tenantId,
        orders.map((order) => order.id),
      ),
      this.organization.outletCharges(target.tenantId, target.outletId),
      this.requests.openFor(target.tenantId, session.id),
    ]);
    const rows = orders.map((order) => {
      const settled = paid.get(order.id);
      return {
        guest: this.toGuestOrder(order, charges, settled?.totalMinor),
        owing: settled === undefined && order.status !== "CANCELED",
      };
    });
    const dueMinor = rows
      .filter((row) => row.owing)
      .reduce((sum, row) => sum + BigInt(row.guest.totalMinor), 0n);
    return guestVisitSchema.parse({
      dueMinor: dueMinor.toString(),
      orders: rows.map((row) => row.guest),
      requests,
    });
  }

  private toGuestOrder(
    order: Order,
    charges: Parameters<typeof computeCharges>[1],
    /** What was paid, once paid; until then the total as of now. */
    paidTotal?: bigint,
  ) {
    return guestOrderSchema.parse({
      lines: order.items.map((item) => {
        const modifiers = [
          ...(item.variantName ? [item.variantName] : []),
          ...item.modifiers.map((modifier) => modifier.optionName),
        ];
        return {
          modifiers,
          name: item.name,
          // Only a plain product can be added again exactly as it was.
          productId: modifiers.length === 0 ? item.productId : null,
          quantity: item.quantity,
        };
      }),
      orderNumber: order.orderNumber,
      status: GUEST_STATUS[order.status] ?? "RECEIVED",
      submittedAt: order.submittedAt,
      totalMinor: (
        paidTotal ?? computeCharges(BigInt(order.subtotalMinor), charges).totalMinor
      ).toString(),
    });
  }

  private async resolve(token: string) {
    const { target } = await this.codes.target(token);
    if (!target) throw invalidQr();
    return target;
  }

  private async ready(token: string) {
    const { resolution, target } = await this.codes.target(token);
    if (!target) throw invalidQr();
    if (resolution.status !== "READY") throw closed();
    return target;
  }
}
