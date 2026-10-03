import type { CreateOrderItem } from "@merchant/contracts";

export type HeldCartRecord = {
  createdAt: Date;
  createdByName: string;
  id: string;
  itemCount: number;
  label: string;
};

export type HeldCartContents = { items: CreateOrderItem[]; label: string };

/** Persistence port for held carts. Every method is scoped by tenant and outlet. */
export interface HeldCartRepository {
  /** Stores a held cart; a repeated idempotency key returns the cart it created. */
  hold(input: {
    createdBy: string;
    idempotencyKey: string;
    itemCount: number;
    items: CreateOrderItem[];
    label: string;
    outletId: string;
    tenantId: string;
  }): Promise<HeldCartRecord>;
  list(tenantId: string, outletId: string): Promise<HeldCartRecord[]>;
  /** Removes the cart and returns what it held, or null when someone else took it first. */
  take(tenantId: string, outletId: string, id: string): Promise<HeldCartContents | null>;
}

export const HELD_CART_REPOSITORY = Symbol("HELD_CART_REPOSITORY");
