import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import type {
  ReadScope,
  ReadSnapshot,
  ReadSnapshots,
} from "../../../shared/query/read-snapshot.js";

type Transaction = Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0];
const active = new WeakMap<ReadSnapshot, Transaction>();

/** Adapter-only accessor; no ORM object crosses an application/domain port. */
export function readDatabase(scope: ReadScope, snapshot?: ReadSnapshot) {
  if (!snapshot) return getPrismaClient();
  const transaction = active.get(snapshot);
  if (
    !transaction ||
    snapshot.tenantId !== scope.tenantId ||
    snapshot.outletId !== scope.outletId
  ) {
    throw new Error("Read snapshot is expired or belongs to another scope.");
  }
  return transaction;
}

@Injectable()
export class PrismaReadSnapshots implements ReadSnapshots {
  run<T>(scope: ReadScope, read: (snapshot: ReadSnapshot) => Promise<T>): Promise<T> {
    return getPrismaClient().$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
        const snapshot: ReadSnapshot = Object.freeze({
          ...scope,
          lifetime: Symbol("read-snapshot"),
        });
        active.set(snapshot, transaction);
        try {
          return await read(snapshot);
        } finally {
          active.delete(snapshot);
        }
      },
      { isolationLevel: "RepeatableRead", maxWait: 3000, timeout: 10000 },
    );
  }
}
