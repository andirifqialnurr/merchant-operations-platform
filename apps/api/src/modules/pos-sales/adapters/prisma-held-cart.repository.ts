import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import type { HeldCartRecord, HeldCartRepository } from "../application/held-cart.repository.js";
import { heldLinesSchema } from "../application/held-cart.service.js";

const cartSelect = {
  createdAt: true,
  creator: { select: { displayName: true } },
  id: true,
  itemCount: true,
  label: true,
} as const;

type CartRow = {
  createdAt: Date;
  creator: { displayName: string };
  id: string;
  itemCount: number;
  label: string;
};

function toRecord({ creator, ...row }: CartRow): HeldCartRecord {
  return { ...row, createdByName: creator.displayName };
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

@Injectable()
export class PrismaHeldCartRepository implements HeldCartRepository {
  async hold(input: Parameters<HeldCartRepository["hold"]>[0]) {
    const { idempotencyKey, outletId, tenantId } = input;
    try {
      return toRecord(
        await getPrismaClient().posHeldCart.create({
          data: {
            createdBy: input.createdBy,
            idempotencyKey,
            itemCount: input.itemCount,
            label: input.label,
            lines: input.items,
            outletId,
            tenantId,
          },
          select: cartSelect,
        }),
      );
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      // A retry of the same hold returns the cart it already created.
      return toRecord(
        await getPrismaClient().posHeldCart.findUniqueOrThrow({
          select: cartSelect,
          where: { tenantId_outletId_idempotencyKey: { idempotencyKey, outletId, tenantId } },
        }),
      );
    }
  }

  async list(tenantId: string, outletId: string) {
    const rows = await getPrismaClient().posHeldCart.findMany({
      orderBy: { createdAt: "asc" },
      select: cartSelect,
      where: { outletId, tenantId },
    });
    return rows.map(toRecord);
  }

  async take(tenantId: string, outletId: string, id: string) {
    return getPrismaClient().$transaction(async (transaction) => {
      const row = await transaction.posHeldCart.findFirst({
        select: { label: true, lines: true },
        where: { id, outletId, tenantId },
      });
      if (!row) return null;
      // The delete waits on any concurrent take of the same row; only the
      // first one removes it, so two cashiers never take the same cart.
      const deleted = await transaction.posHeldCart.deleteMany({
        where: { id, outletId, tenantId },
      });
      if (deleted.count !== 1) return null;
      return { items: heldLinesSchema.parse(row.lines), label: row.label };
    });
  }
}
