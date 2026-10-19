/**
 * Technical serialization key shared by visit/order/payment adapters. It owns
 * no domain data. Acquire before order row locks; never lock another visit.
 */
export async function lockTableVisit(
  transaction: { $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown> },
  tenantId: string,
  visitId: string | null,
) {
  if (visitId) {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`table-visit:${tenantId}:${visitId}`}, 0))`;
  }
}
