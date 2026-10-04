import { getPrismaClient } from "@merchant/database";

export type IdempotencyRequest = {
  tenantId: string;
  outletId: string | null;
  scope: string;
  key: string;
  requestHash: string;
};

export type IdempotencyRecord = {
  id: string;
  requestHash: string | null;
  status: "PENDING" | "COMPLETED" | "FAILED";
  responseStatus: number | null;
  responseBody: unknown;
  expiresAt: Date;
};

export interface IdempotencyRepository {
  reserve(request: IdempotencyRequest): Promise<{ created: boolean; record: IdempotencyRecord }>;
  complete(id: string, status: number, body: unknown): Promise<void>;
  fail(id: string): Promise<void>;
}

export class PrismaIdempotencyRepository implements IdempotencyRepository {
  async reserve(request: IdempotencyRequest) {
    const db = getPrismaClient();
    // Both the ordinary unique index and the partial index for a null outlet
    // participate in ON CONFLICT; only one request can own a key.
    const created = await db.idempotencyKey.createMany({
      data: [{ ...request, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) }],
      skipDuplicates: true,
    });
    const record = await db.idempotencyKey.findFirstOrThrow({
      where: {
        tenantId: request.tenantId,
        outletId: request.outletId,
        scope: request.scope,
        key: request.key,
      },
    });
    return { created: created.count === 1, record };
  }

  async complete(id: string, status: number, body: unknown) {
    // Explicit JSON null also supports endpoints with no response body.
    await getPrismaClient().$executeRaw`
      UPDATE idempotency_keys
      SET status = 'COMPLETED', response_status = ${status},
          response_body = ${JSON.stringify(body ?? null)}::jsonb, updated_at = NOW()
      WHERE id = ${id}::uuid AND status = 'PENDING'
    `;
  }

  async fail(id: string) {
    await getPrismaClient().idempotencyKey.updateMany({
      data: { status: "FAILED" },
      where: { id, status: "PENDING" },
    });
  }
}
