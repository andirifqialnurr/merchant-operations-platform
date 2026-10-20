import { entityIdParamsSchema, idempotencyKeySchema } from "@merchant/contracts";
import type { DatabaseClient } from "@merchant/database";

type Transaction = Parameters<Parameters<DatabaseClient["$transaction"]>[0]>[0];

export type TransactionalCommandCode =
  | "IDEMPOTENCY_KEY_REUSED"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "IDEMPOTENCY_FAILED"
  | "IDEMPOTENCY_EXPIRED"
  | "IDEMPOTENCY_RESULT_UNAVAILABLE";

export class TransactionalCommandError extends Error {
  constructor(readonly code: TransactionalCommandCode) {
    super(code);
  }
}

/** Adapter-only opt-in. MUST run inside the same interactive transaction as mutate.
 * Non-secret JSON results only. The caller owns the transaction and current authorization.
 * Core owns reservation/replay/completion; failed callbacks roll back with their caller.
 * parseResult validates DTO shape only; owner DB checks stay outside it in the same TX.
 */
export async function runTransactionalWorkspaceCommand<Result>(
  transaction: Transaction,
  request: {
    tenantId: string;
    scope: string;
    key: string;
    requestHash: string;
    responseStatus: number;
  },
  parseResult: (value: unknown) => Result | Promise<Result>,
  mutate: () => Promise<Result>,
): Promise<Result> {
  const where = {
    tenantId: entityIdParamsSchema.parse({ id: request.tenantId }).id.toLowerCase(),
    outletId: null,
    scope: request.scope,
    key: idempotencyKeySchema.parse(request.key),
  };
  if (
    typeof where.scope !== "string" ||
    !/^[A-Za-z0-9_.:-]{1,120}$/.test(where.scope) ||
    typeof request.requestHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(request.requestHash) ||
    !Number.isInteger(request.responseStatus) ||
    request.responseStatus < 200 ||
    request.responseStatus > 299
  )
    throw new Error("Invalid transactional workspace command metadata.");
  const claimed = await transaction.idempotencyKey.createMany({
    data: [
      { ...where, requestHash: request.requestHash, expiresAt: new Date(Date.now() + 86_400_000) },
    ],
    skipDuplicates: true,
  });
  const parse = async (body: unknown) => {
    try {
      return await parseResult(body);
    } catch {
      throw new TransactionalCommandError("IDEMPOTENCY_RESULT_UNAVAILABLE");
    }
  };
  if (claimed.count === 0) {
    const record = await transaction.idempotencyKey.findFirstOrThrow({ where });
    if (record.requestHash !== request.requestHash)
      throw new TransactionalCommandError("IDEMPOTENCY_KEY_REUSED");
    if (record.status === "PENDING") throw new TransactionalCommandError("IDEMPOTENCY_IN_PROGRESS");
    if (record.status === "FAILED") throw new TransactionalCommandError("IDEMPOTENCY_FAILED");
    if (record.expiresAt <= new Date()) throw new TransactionalCommandError("IDEMPOTENCY_EXPIRED");
    if (record.responseStatus !== request.responseStatus)
      throw new TransactionalCommandError("IDEMPOTENCY_RESULT_UNAVAILABLE");
    return parse(record.responseBody);
  }
  const result = await parse(await mutate());
  const body = JSON.stringify(result);
  if (body === undefined) throw new TransactionalCommandError("IDEMPOTENCY_RESULT_UNAVAILABLE");
  const completed = await transaction.$executeRaw`
    UPDATE idempotency_keys SET status = 'COMPLETED', response_status = ${request.responseStatus},
      response_body = ${body}::jsonb, updated_at = NOW()
    WHERE tenant_id = ${where.tenantId}::uuid AND outlet_id IS NULL
      AND scope = ${where.scope} AND key = ${where.key}
      AND request_hash = ${request.requestHash} AND status = 'PENDING'
  `;
  if (completed !== 1) throw new TransactionalCommandError("IDEMPOTENCY_RESULT_UNAVAILABLE");
  return result;
}
