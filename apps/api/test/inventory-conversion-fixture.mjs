import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { AccessService } from "../src/core/memberships/public.ts";
import { PrismaAccessRepository } from "../src/core/memberships/access.repository.ts";
import { InventoryMasterWriteAuthorizer } from "../src/modules/inventory/adapters/inventory-master-write-access.ts";
import { PrismaInventoryConversionWriter } from "../src/modules/inventory/adapters/persistence/prisma-inventory-conversion-writer.ts";
import { CreateInventoryUnitConversion } from "../src/modules/inventory/application/create-inventory-unit-conversion.ts";

export const scopeOf = (identity) => `inventory.unit_conversion.create:${identity.userId}`;
export const attempt = (identity, key = `conversion:${randomUUID()}`) => ({
  identity,
  idempotencyKey: key,
  origin: { actorId: identity.userId, channel: "WEB", requestId: randomUUID() },
});
export async function denied(promise, code, status = 409) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.getResponse().code, code);
    assert.equal(error.getStatus(), status);
    return true;
  });
}
export async function pair(db, tenantId, dimensions = ["MASS", "MASS"], precision = 6) {
  const units = [];
  for (const [i, dimension] of dimensions.entries())
    units.push(
      await db.inventoryUnit.create({
        data: {
          tenantId,
          code: `u${randomUUID().slice(0, 12)}${i}`,
          name: "Fixture",
          precision,
          dimension,
        },
      }),
    );
  return { fromUnitId: units[0].id, toUnitId: units[1].id, factor: "1000" };
}
export async function fixture(db) {
  const access = new AccessService(new PrismaAccessRepository());
  const businesses = [];
  for (const slug of ["conversion-a", "conversion-b"]) {
    const tenant = await db.tenant.create({ data: { name: slug, slug } });
    const user = await db.user.create({
      data: { displayName: slug, email: `${slug}@example.test`, passwordHash: "fixture-only" },
    });
    await access.provisionTenantOwner(tenant.id, user.id);
    const membership = await db.tenantMembership.findUniqueOrThrow({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    });
    businesses.push({ tenantId: tenant.id, userId: user.id, membershipId: membership.id });
  }
  // Test-owned entitlement facade, not manifest delivery or production activation.
  const facts = {
    subscriptionUsable: true,
    module: { entitled: true, tier: "BASIC" },
    installation: "ACTIVE",
    capabilities: new Set(["inventory.item.manage"]),
    snapshot: { modules: [], subscription: null },
  };
  const authorizer = new InventoryMasterWriteAuthorizer(access, {
    describeAccess: async () => facts,
  });
  const writer = new PrismaInventoryConversionWriter();
  return {
    a: businesses[0],
    b: businesses[1],
    facts,
    writer,
    command: new CreateInventoryUnitConversion(authorizer, writer),
  };
}
export async function absent(db, identity, body, ctx) {
  assert.equal(
    await db.inventoryUnitConversion.count({
      where: { tenantId: identity.tenantId, fromUnitId: body.fromUnitId, toUnitId: body.toUnitId },
    }),
    0,
  );
  assert.equal(
    await db.idempotencyKey.count({
      where: { tenantId: identity.tenantId, scope: scopeOf(identity), key: ctx.idempotencyKey },
    }),
    0,
  );
  assert.equal(
    await db.auditLog.count({
      where: {
        tenantId: identity.tenantId,
        action: "inventory.unit_conversion.create",
        metadata: { path: ["after", "fromUnitId"], equals: body.fromUnitId },
      },
    }),
    0,
  );
  const parents = await db.inventoryUnit.findMany({
    where: { tenantId: identity.tenantId, id: { in: [body.fromUnitId, body.toUnitId] } },
    select: { definitionLocked: true },
  });
  assert.ok(parents.every((row) => !row.definitionLocked));
}
export async function waitForBlocked(database, blockerPid) {
  const deadline = Date.now() + 5_000;
  do {
    const { rows } = await database.query(
      "SELECT pid FROM pg_stat_activity WHERE $1::int = ANY(pg_blocking_pids(pid))",
      [blockerPid],
    );
    if (rows.length) return rows[0].pid;
    await setTimeout(10);
  } while (Date.now() < deadline);
  assert.fail("Expected a transaction blocked behind the fixture's owned connection");
}
