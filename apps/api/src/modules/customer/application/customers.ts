import {
  customerDetailSchema,
  customerSchema,
  type CreateCustomer,
  type UpdateCustomer,
} from "@merchant/contracts";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  type OnModuleInit,
  Optional,
} from "@nestjs/common";

import { BillingService } from "../../../kernels/billing-payment-ledger/public.js";
import { OrderIntakeService } from "../../../kernels/order-intake/public.js";
import type { ActorCommandOrigin } from "../../../shared/command/command-origin.js";
import {
  LIMIT_GATE,
  NO_LIMITS,
  USAGE_GAUGE_REGISTRY,
  type LimitGate,
  type UsageGaugeRegistry,
} from "../../../shared/limits/limit-gate.js";
import {
  CUSTOMER_REPOSITORY,
  CustomerPhoneTakenError,
  type CustomerRecord,
  type CustomerRepository,
} from "./customer.repository.js";

export const CUSTOMER_PROFILES_DIMENSION = "customer.profiles.active";
const SEARCH_LIMIT = 20;

const notFound = () =>
  new NotFoundException({ code: "CUSTOMER_NOT_FOUND", message: "This customer was not found." });
const phoneTaken = () =>
  new ConflictException({
    code: "CUSTOMER_PHONE_TAKEN",
    message: "Another customer already has this phone number.",
  });

/**
 * A customer as one person sees them. The full phone number goes only to
 * those allowed to see contacts (M4-SC-03); everyone else gets its last four
 * digits to tell two customers apart.
 */
export function toCustomer(record: CustomerRecord, seeContact: boolean) {
  return customerSchema.parse({
    id: record.id,
    lastVisitAt: record.lastVisitAt?.toISOString() ?? null,
    name: record.name,
    note: record.note,
    phone: seeContact ? record.phone : null,
    phoneEnding: record.phone ? record.phone.slice(-4) : null,
    spendMinor: record.spendMinor.toString(),
    visitCount: record.visitCount,
  });
}

/** Customer Basic: who they are, finding them, and the orders linked to them. */
@Injectable()
export class Customers implements OnModuleInit {
  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(OrderIntakeService) private readonly orders: OrderIntakeService,
    @Inject(BillingService) private readonly billing: BillingService,
    @Optional() @Inject(LIMIT_GATE) private readonly limits: LimitGate = NO_LIMITS,
    @Optional() @Inject(USAGE_GAUGE_REGISTRY) private readonly gauges?: UsageGaugeRegistry,
  ) {}

  onModuleInit() {
    this.gauges?.register(CUSTOMER_PROFILES_DIMENSION, async (tenantId) =>
      BigInt(await this.customers.countActive(tenantId)),
    );
  }

  /** By name, or by phone when the search has four or more digits. */
  async search(tenantId: string, q: string | undefined, seeContact: boolean) {
    const text = q?.trim() ?? "";
    const digits = text.replace(/\D/g, "");
    const found = await this.customers.search(
      tenantId,
      {
        ...(text && digits.length < 4 ? { text } : {}),
        ...(digits.length >= 4 ? { digits } : {}),
      },
      SEARCH_LIMIT,
    );
    return found.map((record) => toCustomer(record, seeContact));
  }

  async detail(tenantId: string, id: string, seeContact: boolean) {
    const record = await this.customers.find(tenantId, id);
    if (!record) throw notFound();
    const visits = await this.customers.visits(tenantId, id);
    return customerDetailSchema.parse({
      customer: toCustomer(record, seeContact),
      visits: visits.map((visit) => ({
        at: visit.at.toISOString(),
        currency: visit.currency,
        orderNumber: visit.orderNumber,
        saleNumber: visit.saleNumber,
        totalMinor: visit.totalMinor?.toString() ?? null,
      })),
    });
  }

  async create(
    tenantId: string,
    input: CreateCustomer,
    origin: ActorCommandOrigin,
    seeContact: boolean,
  ) {
    await this.limits.assertCanAdd(tenantId, CUSTOMER_PROFILES_DIMENSION);
    try {
      const created = await this.customers.create(
        tenantId,
        { name: input.name ?? null, note: input.note ?? null, phone: input.phone ?? null },
        origin,
      );
      return toCustomer(created, seeContact);
    } catch (error) {
      if (error instanceof CustomerPhoneTakenError) throw phoneTaken();
      throw error;
    }
  }

  async update(
    tenantId: string,
    id: string,
    change: UpdateCustomer,
    origin: ActorCommandOrigin,
    seeContact: boolean,
  ) {
    const current = await this.customers.find(tenantId, id);
    if (!current || current.status !== "ACTIVE") throw notFound();
    // Without contact rights the number is not shown, so it is not changed either.
    if (change.phone !== undefined && !seeContact) {
      throw new ConflictException({
        code: "CUSTOMER_CONTACT_HIDDEN",
        message: "Only roles that see phone numbers can change them.",
      });
    }
    const name = change.name === undefined ? current.name : change.name;
    const phone = change.phone === undefined ? current.phone : change.phone;
    if (!name && !phone) {
      throw new BadRequestException({
        code: "CUSTOMER_IDENTITY_REQUIRED",
        message: "A customer needs a name or a phone number.",
      });
    }
    try {
      const updated = await this.customers.update(
        tenantId,
        id,
        {
          ...(change.name !== undefined ? { name: change.name } : {}),
          ...(change.note !== undefined ? { note: change.note } : {}),
          ...(change.phone !== undefined ? { phone: change.phone } : {}),
        },
        origin,
      );
      if (!updated) throw notFound();
      return toCustomer(updated, seeContact);
    } catch (error) {
      if (error instanceof CustomerPhoneTakenError) throw phoneTaken();
      throw error;
    }
  }

  /**
   * Links an order of the outlet to the customer. An order already paid
   * brings its sale along; one paid later gets it from `sale.completed.v1`.
   */
  async linkOrder(
    tenantId: string,
    outletId: string,
    customerId: string,
    orderId: string,
    origin: ActorCommandOrigin,
    seeContact: boolean,
  ) {
    const customer = await this.customers.find(tenantId, customerId);
    if (!customer || customer.status !== "ACTIVE") throw notFound();
    const order = await this.orders.getOrder(tenantId, outletId, orderId);
    if (order.status === "CANCELED") {
      throw new ConflictException({
        code: "ORDER_CANCELED",
        message: "A canceled order cannot be linked.",
      });
    }
    const paid = (await this.billing.paidOrders(tenantId, [orderId])).get(orderId);
    const outcome = await this.customers.linkOrder(
      tenantId,
      {
        customerId,
        orderId,
        orderNumber: order.orderNumber,
        outletId,
        sale: paid
          ? {
              completedAt: null,
              currency: order.currency,
              saleNumber: paid.saleNumber,
              totalMinor: paid.totalMinor,
            }
          : null,
      },
      origin,
    );
    if (outcome === "taken") {
      throw new ConflictException({
        code: "CUSTOMER_ORDER_LINKED",
        message: "This order is already linked to another customer.",
      });
    }
    return this.detail(tenantId, customerId, seeContact);
  }

  async customerOfOrder(tenantId: string, orderId: string, seeContact: boolean) {
    const record = await this.customers.customerOfOrder(tenantId, orderId);
    return record ? toCustomer(record, seeContact) : null;
  }

  /** From `sale.completed.v1`: the linked order was paid. */
  recordSale(
    tenantId: string,
    orderId: string,
    sale: { completedAt: Date; currency: string; saleNumber: number; totalMinor: bigint },
  ) {
    return this.customers.recordSale(tenantId, orderId, sale);
  }
}
