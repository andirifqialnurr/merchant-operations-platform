import type { ActorCommandOrigin } from "../../../shared/command/command-origin.js";

export type CustomerRecord = {
  id: string;
  lastVisitAt: Date | null;
  name: string | null;
  note: string | null;
  phone: string | null;
  spendMinor: bigint;
  status: "ACTIVE" | "ARCHIVED";
  visitCount: number;
};

export type CustomerVisitRecord = {
  at: Date;
  currency: string | null;
  orderNumber: number;
  saleNumber: number | null;
  totalMinor: bigint | null;
};

/** What a paid order became. */
export type LinkedSale = {
  completedAt: Date | null;
  currency: string;
  saleNumber: number;
  totalMinor: bigint;
};

export type NewOrderLink = {
  customerId: string;
  orderId: string;
  orderNumber: number;
  outletId: string;
  /** Set when the order was paid before it was linked. */
  sale: LinkedSale | null;
};

/** Thrown when another active customer already has the phone number. */
export class CustomerPhoneTakenError extends Error {}

/** Where customers and the orders linked to them are kept. */
export interface CustomerRepository {
  /** Active customers whose name contains `text` or whose phone contains `digits`; newest first without either. */
  search(
    tenantId: string,
    query: { digits?: string; text?: string },
    limit: number,
  ): Promise<CustomerRecord[]>;
  find(tenantId: string, id: string): Promise<CustomerRecord | null>;
  /** Linked orders, newest first. */
  visits(tenantId: string, customerId: string): Promise<CustomerVisitRecord[]>;
  create(
    tenantId: string,
    input: { name: string | null; note: string | null; phone: string | null },
    origin: ActorCommandOrigin,
  ): Promise<CustomerRecord>;
  update(
    tenantId: string,
    id: string,
    change: { name?: string | null; note?: string | null; phone?: string | null },
    origin: ActorCommandOrigin,
  ): Promise<CustomerRecord | null>;
  countActive(tenantId: string): Promise<number>;
  /** "taken" when the order already belongs to another customer; "same" when to this one. */
  linkOrder(
    tenantId: string,
    link: NewOrderLink,
    origin: ActorCommandOrigin,
  ): Promise<"linked" | "same" | "taken">;
  customerOfOrder(tenantId: string, orderId: string): Promise<CustomerRecord | null>;
  /** Fills in the sale of a linked order; false when the order is not linked. */
  recordSale(tenantId: string, orderId: string, sale: LinkedSale): Promise<boolean>;
}

export const CUSTOMER_REPOSITORY = Symbol("CUSTOMER_REPOSITORY");
