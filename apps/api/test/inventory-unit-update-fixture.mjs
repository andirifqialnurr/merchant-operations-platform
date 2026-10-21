import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { AccessService } from "../src/core/memberships/public.ts";
import { PrismaAccessRepository } from "../src/core/memberships/access.repository.ts";
import { InventoryMasterWriteAuthorizer } from "../src/modules/inventory/adapters/inventory-master-write-access.ts";
import { PrismaInventoryUnitUpdater } from "../src/modules/inventory/adapters/persistence/prisma-inventory-unit-updater.ts";
import { PrismaInventoryUnitWriter } from "../src/modules/inventory/adapters/persistence/prisma-inventory-unit-writer.ts";
import { UpdateInventoryUnit } from "../src/modules/inventory/application/update-inventory-unit.ts";
import { CreateInventoryUnit } from "../src/modules/inventory/application/create-inventory-unit.ts";

export const scopeOf = (identity) => `inventory.unit.update:${identity.userId}`;
export const attempt = (identity, key = `unit-update:${randomUUID()}`) => ({
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
export async function unit(db, identity, extra = {}) {
  return db.inventoryUnit.create({
    data: {
      tenantId: identity.tenantId,
      code: `u${randomUUID().slice(0, 12)}`,
      name: "Original",
      precision: 6,
      dimension: "MASS",
      ...extra,
    },
  });
}
export async function fixture(db) {
  const access = new AccessService(new PrismaAccessRepository());
  const businesses = [];
  for (const slug of ["unit-update-a", "unit-update-b"]) {
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
  const updater = new PrismaInventoryUnitUpdater();
  return {
    a: businesses[0],
    b: businesses[1],
    facts,
    updater,
    command: new UpdateInventoryUnit(authorizer, updater),
    creator: new CreateInventoryUnit(authorizer, new PrismaInventoryUnitWriter()),
  };
}
export async function snapshot(db, tenantId) {
  return {
    units: await db.inventoryUnit.findMany({ where: { tenantId }, orderBy: { id: "asc" } }),
    audits: await db.auditLog.findMany({ where: { tenantId }, orderBy: { id: "asc" } }),
    keys: await db.idempotencyKey.findMany({ where: { tenantId }, orderBy: { id: "asc" } }),
  };
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
  assert.fail("Expected a transaction blocked behind the invocation-owned connection");
}
