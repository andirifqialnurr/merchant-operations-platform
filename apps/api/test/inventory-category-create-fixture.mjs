import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { AccessService } from "../src/core/memberships/public.ts";
import { PrismaAccessRepository } from "../src/core/memberships/access.repository.ts";
import { InventoryMasterWriteAuthorizer } from "../src/modules/inventory/adapters/inventory-master-write-access.ts";
import { InventoryMasterReadAuthorizer } from "../src/modules/inventory/adapters/inventory-master-read-access.ts";
import { PrismaInventoryCategoryWriter } from "../src/modules/inventory/adapters/persistence/prisma-inventory-category-writer.ts";
import { PrismaInventoryCategoryReader } from "../src/modules/inventory/adapters/persistence/prisma-inventory-category-reader.ts";
import { CreateInventoryCategory } from "../src/modules/inventory/application/create-inventory-category.ts";
import { ReadInventoryCategories } from "../src/modules/inventory/application/read-inventory-categories.ts";

export const scopeOf = (identity) => `inventory.category.create:${identity.userId}`;
export const attempt = (identity, key = `category:${randomUUID()}`) => ({
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
export async function fixture(db) {
  const access = new AccessService(new PrismaAccessRepository());
  const businesses = [];
  for (const slug of ["category-create-a", "category-create-b"]) {
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
  // Entitlement facts are test-owned, not production installation or capability grants.
  const facts = {
    subscriptionUsable: true,
    module: { entitled: true, tier: "BASIC" },
    installation: "ACTIVE",
    capabilities: new Set(["inventory.item.manage"]),
    snapshot: { modules: [], subscription: null },
  };
  const entitlements = { describeAccess: async () => facts };
  const authorizer = new InventoryMasterWriteAuthorizer(access, entitlements);
  const writer = new PrismaInventoryCategoryWriter();
  return {
    a: businesses[0],
    b: businesses[1],
    facts,
    writer,
    command: new CreateInventoryCategory(authorizer, writer),
    query: new ReadInventoryCategories(
      new InventoryMasterReadAuthorizer(access, entitlements),
      new PrismaInventoryCategoryReader(),
    ),
  };
}
export async function snapshot(db, tenantId) {
  return {
    categories: await db.inventoryCategory.findMany({
      where: { tenantId },
      orderBy: { id: "asc" },
    }),
    audits: await db.auditLog.findMany({ where: { tenantId }, orderBy: { id: "asc" } }),
    keys: await db.idempotencyKey.findMany({ where: { tenantId }, orderBy: { id: "asc" } }),
  };
}
