import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import test from "node:test";
import { URL } from "node:url";
import { PERMISSIONS } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { AccessService } from "../src/core/memberships/public.ts";
import { PrismaAccessRepository } from "../src/core/memberships/access.repository.ts";
import { runTransactionalWorkspaceCommand } from "../src/core/idempotency/public.ts";
import { CreateInventoryUnit } from "../src/modules/inventory/application/create-inventory-unit.ts";
import { InventoryMasterWriteAuthorizer } from "../src/modules/inventory/adapters/inventory-master-write-access.ts";
import { PrismaInventoryUnitWriter } from "../src/modules/inventory/adapters/persistence/prisma-inventory-unit-writer.ts";

const scopeOf = (identity) => `inventory.unit.create:${identity.userId}`;
const attempt = (identity, key = `unit:${randomUUID()}`) => ({
  identity,
  idempotencyKey: key,
  origin: { actorId: identity.userId, channel: "WEB", requestId: randomUUID() },
});
async function denied(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.getResponse().code, code);
    return true;
  });
}

async function business(db, access, slug) {
  const tenant = await db.tenant.create({ data: { name: slug, slug } });
  const user = await db.user.create({
    data: { displayName: slug, email: `${slug}@example.test`, passwordHash: "fixture-only" },
  });
  await access.provisionTenantOwner(tenant.id, user.id);
  const membership = await db.tenantMembership.findUniqueOrThrow({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
  });
  return { tenantId: tenant.id, userId: user.id, membershipId: membership.id };
}

async function absent(db, identity, code, key) {
  assert.equal(await db.inventoryUnit.count({ where: { tenantId: identity.tenantId, code } }), 0);
  assert.equal(
    await db.idempotencyKey.count({
      where: { tenantId: identity.tenantId, scope: scopeOf(identity), key },
    }),
    0,
  );
  assert.equal(
    await db.auditLog.count({
      where: {
        tenantId: identity.tenantId,
        action: "inventory.unit.create",
        metadata: { path: ["after", "code"], equals: code },
      },
    }),
    0,
  );
}

test("create Inventory unit commits an authorized definition, audit and replay result atomically", async (t) => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const access = new AccessService(new PrismaAccessRepository());
      const a = await business(db, access, "unit-create-a");
      const b = await business(db, access, "unit-create-b");
      // Test-owned entitlement facts only; no production manifest/activation is introduced.
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
      const writer = new PrismaInventoryUnitWriter();
      const command = new CreateInventoryUnit(authorizer, writer);
      const outboxBefore = await db.outboxEvent.count();

      await t.test(
        "permission migration is repeatable, minimal and matches new-workspace default roles",
        async () => {
          const extra = await db.tenant.create({
            data: { name: "Custom", slug: "unit-create-custom" },
          });
          const custom = await db.role.create({
            data: { tenantId: extra.id, name: "Custom owner", code: "OWNER", isSystem: false },
          });
          await db.rolePermission.deleteMany({
            where: { tenantId: a.tenantId, permissionKey: PERMISSIONS.inventoryMasterManage },
          });
          const migration = await readFile(
            new URL(
              "../../../packages/database/prisma/migrations/20261021010000_inventory_master_permission/migration.sql",
              import.meta.url,
            ),
            "utf8",
          );
          await database.query(migration);
          await database.query(migration);
          for (const tenantId of [a.tenantId, b.tenantId]) {
            const roles = await db.role.findMany({
              where: { tenantId },
              include: { permissions: true },
            });
            for (const role of roles)
              assert.equal(
                role.permissions.some(
                  (row) => row.permissionKey === PERMISSIONS.inventoryMasterManage,
                ),
                ["OWNER", "MANAGER"].includes(role.code),
              );
          }
          assert.equal(
            await db.rolePermission.count({
              where: { roleId: custom.id, permissionKey: PERMISSIONS.inventoryMasterManage },
            }),
            0,
          );
        },
      );

      await t.test(
        "a new unit returns only its authoritative DTO and one critical correctly attributed audit/key",
        async () => {
          const ctx = attempt(a);
          const result = await command.execute(
            { code: "kg", name: "Kilogram", precision: 3, dimension: "MASS" },
            ctx,
          );
          assert.deepEqual(Object.keys(result).sort(), [
            "code",
            "dimension",
            "id",
            "name",
            "precision",
          ]);
          const audit = await db.auditLog.findFirstOrThrow({
            where: { tenantId: a.tenantId, entityId: result.id, action: "inventory.unit.create" },
          });
          assert.equal(audit.actorId, a.userId);
          assert.equal(audit.outletId, null);
          assert.equal(audit.channel, "WEB");
          assert.equal(audit.requestId, ctx.origin.requestId);
          assert.equal(audit.correlationId, ctx.origin.requestId);
          assert.deepEqual(audit.metadata, {
            critical: true,
            after: { code: "kg", precision: 3, dimension: "MASS" },
          });
          const row = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          assert.equal(row.outletId, null);
          assert.equal(row.status, "COMPLETED");
          assert.equal(row.responseStatus, 201);
          assert.deepEqual(row.responseBody, result);
          assert.match(row.requestHash, /^[a-f0-9]{64}$/);
          assert.equal(
            (await db.inventoryUnit.findUniqueOrThrow({ where: { id: result.id } }))
              .definitionLocked,
            false,
          );
        },
      );

      await t.test(
        "normalized retries return the ORIGINAL snapshot without rewriting unit, audit or key",
        async () => {
          const key = `normalized:${randomUUID()}`;
          const ctx = attempt(a, ` ${key} `);
          const first = await command.execute(
            { code: " g ", name: " Gram ", precision: 6, dimension: "MASS" },
            ctx,
          );
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key },
          });
          await db.inventoryUnit.update({
            where: { id: first.id },
            data: { name: "Updated label" },
          });
          assert.deepEqual(
            await command.execute(
              { precision: 6, name: "Gram", code: "g", dimension: "MASS" },
              attempt(a, key),
            ),
            first,
          );
          assert.equal(
            (await db.inventoryUnit.findUniqueOrThrow({ where: { id: first.id } })).name,
            "Updated label",
          );
          assert.equal(
            await db.auditLog.count({
              where: { tenantId: a.tenantId, entityId: first.id, action: "inventory.unit.create" },
            }),
            1,
          );
          assert.deepEqual(
            await db.idempotencyKey.findUniqueOrThrow({ where: { id: record.id } }),
            record,
          );
          await denied(
            command.execute(
              { code: "G", name: "Gram", precision: 6, dimension: "MASS" },
              attempt(a, key),
            ),
            "IDEMPOTENCY_KEY_REUSED",
          );
        },
      );

      await t.test("concurrent same-key creates have one ID/audit/completed result", async () => {
        const ctx = attempt(a);
        const body = { code: "pcs", name: "Piece", precision: 0, dimension: "COUNT" };
        const results = await Promise.all(
          Array.from({ length: 8 }, () => command.execute(body, ctx)),
        );
        assert.equal(new Set(results.map((row) => row.id)).size, 1);
        assert.equal(
          await db.inventoryUnit.count({ where: { tenantId: a.tenantId, code: "pcs" } }),
          1,
        );
        assert.equal(
          await db.auditLog.count({
            where: {
              tenantId: a.tenantId,
              entityId: results[0].id,
              action: "inventory.unit.create",
            },
          }),
          1,
        );
        assert.equal(
          await db.idempotencyKey.count({
            where: {
              tenantId: a.tenantId,
              scope: scopeOf(a),
              key: ctx.idempotencyKey,
              status: "COMPLETED",
            },
          }),
          1,
        );
      });

      await t.test(
        "different-key CI code races conflict without leaving failed reservations or audit rows",
        async () => {
          const contexts = [attempt(a), attempt(a)];
          const results = await Promise.allSettled([
            command.execute(
              { code: "ml", name: "Millilitre", precision: 6, dimension: "VOLUME" },
              contexts[0],
            ),
            command.execute(
              { code: "ML", name: "Millilitre", precision: 6, dimension: "VOLUME" },
              contexts[1],
            ),
          ]);
          assert.equal(results.filter((row) => row.status === "fulfilled").length, 1);
          assert.equal(
            results.find((row) => row.status === "rejected").reason.getResponse().code,
            "INVENTORY_UNIT_CODE_TAKEN",
          );
          assert.equal(
            await db.inventoryUnit.count({
              where: { tenantId: a.tenantId, code: { in: ["ml", "ML"] } },
            }),
            1,
          );
          assert.equal(
            await db.idempotencyKey.count({
              where: {
                tenantId: a.tenantId,
                scope: scopeOf(a),
                key: { in: contexts.map((ctx) => ctx.idempotencyKey) },
              },
            }),
            1,
          );
        },
      );

      await t.test(
        "tenant/actor scope cannot replay another caller, while body scope/actor fields are rejected",
        async () => {
          const sharedKey = `shared:${randomUUID()}`;
          const first = await command.execute(
            { code: "shared", name: "Shared", precision: 6, dimension: "COUNT" },
            attempt(a, sharedKey),
          );
          const foreign = await command.execute(
            { code: "shared", name: "Shared", precision: 6, dimension: "COUNT" },
            attempt(b, sharedKey),
          );
          assert.notEqual(first.id, foreign.id);
          const managerUser = await db.user.create({
            data: {
              displayName: "Manager",
              email: "unit-manager@example.test",
              passwordHash: "fixture-only",
            },
          });
          const managerMembership = await db.tenantMembership.create({
            data: { tenantId: a.tenantId, userId: managerUser.id, allOutlets: true },
          });
          const managerRole = await db.role.findUniqueOrThrow({
            where: { tenantId_code: { tenantId: a.tenantId, code: "MANAGER" } },
          });
          await db.userRole.create({
            data: {
              tenantId: a.tenantId,
              membershipId: managerMembership.id,
              roleId: managerRole.id,
            },
          });
          const manager = {
            tenantId: a.tenantId,
            userId: managerUser.id,
            membershipId: managerMembership.id,
          };
          await denied(
            command.execute(
              { code: "shared", name: "Shared", precision: 6, dimension: "COUNT" },
              attempt(manager, sharedKey),
            ),
            "INVENTORY_UNIT_CODE_TAKEN",
          );
          const own = await command.execute(
            { code: "manager", name: "Manager unit", precision: 6, dimension: "COUNT" },
            attempt(manager, sharedKey),
          );
          assert.notEqual(first.id, own.id);
          await denied(
            command.execute(
              { code: "bad", name: "Bad", precision: 6, dimension: "COUNT", tenantId: b.tenantId },
              attempt(a),
            ),
            "VALIDATION_ERROR",
          );
          await denied(
            command.execute(
              { code: "bad", name: "Bad", precision: 6, dimension: "COUNT" },
              attempt({ ...a, tenantId: b.tenantId }),
            ),
            "WORKSPACE_ACCESS_DENIED",
          );
        },
      );

      await t.test(
        "revoked permission/scope/membership, device and entitlement refuse even replay without key updates",
        async () => {
          const ctx = attempt(a);
          const body = { code: "guarded", name: "Guarded", precision: 6, dimension: "COUNT" };
          await command.execute(body, ctx);
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          const owner = await db.role.findUniqueOrThrow({
            where: { tenantId_code: { tenantId: a.tenantId, code: "OWNER" } },
          });
          await db.rolePermission.deleteMany({
            where: {
              tenantId: a.tenantId,
              roleId: owner.id,
              permissionKey: PERMISSIONS.inventoryMasterManage,
            },
          });
          await denied(command.execute(body, ctx), "PERMISSION_DENIED");
          await db.rolePermission.create({
            data: {
              tenantId: a.tenantId,
              roleId: owner.id,
              permissionKey: PERMISSIONS.inventoryMasterManage,
            },
          });
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { allOutlets: false },
          });
          await denied(command.execute(body, ctx), "LOCATION_SCOPE_DENIED");
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { allOutlets: true },
          });
          await denied(
            command.execute(body, { ...ctx, identity: { ...a, deviceId: randomUUID() } }),
            "LOCATION_SCOPE_DENIED",
          );
          facts.capabilities.clear();
          await denied(command.execute(body, ctx), "ENTITLEMENT_REQUIRED");
          facts.capabilities.add("inventory.item.manage");
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { status: "INACTIVE" },
          });
          await denied(command.execute(body, ctx), "WORKSPACE_ACCESS_DENIED");
          await db.tenantMembership.update({
            where: { id: a.membershipId },
            data: { status: "ACTIVE" },
          });
          assert.deepEqual(
            await db.idempotencyKey.findUniqueOrThrow({ where: { id: record.id } }),
            record,
          );
        },
      );

      await t.test(
        "audit failure and invalid serialized result roll back unit, audit and reservation together",
        async () => {
          await database.query(`CREATE FUNCTION test_inventory_audit_failure() RETURNS trigger AS $$ BEGIN IF NEW.action = 'inventory.unit.create' AND NEW.metadata->'after'->>'code' = 'audit_fail' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
          CREATE TRIGGER test_inventory_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION test_inventory_audit_failure();`);
          const ctx = attempt(a);
          try {
            await assert.rejects(
              command.execute(
                { code: "audit_fail", name: "Failure", precision: 6, dimension: "COUNT" },
                ctx,
              ),
            );
            await absent(db, a, "audit_fail", ctx.idempotencyKey);
          } finally {
            await database.query(
              "DROP TRIGGER test_inventory_audit_failure ON audit_logs; DROP FUNCTION test_inventory_audit_failure()",
            );
          }
          await command.execute(
            { code: "audit_fail", name: "Failure", precision: 6, dimension: "COUNT" },
            ctx,
          );
          await database.query(`CREATE FUNCTION test_inventory_result_failure() RETURNS trigger AS $$ BEGIN IF NEW.code = 'result_fail' THEN NEW.name := 'unexpected'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
          CREATE TRIGGER test_inventory_result_failure BEFORE INSERT ON inventory_units FOR EACH ROW EXECUTE FUNCTION test_inventory_result_failure();`);
          const invalid = attempt(a);
          try {
            await denied(
              command.execute(
                { code: "result_fail", name: "Result", precision: 6, dimension: "COUNT" },
                invalid,
              ),
              "IDEMPOTENCY_RESULT_UNAVAILABLE",
            );
            await absent(db, a, "result_fail", invalid.idempotencyKey);
          } finally {
            await database.query(
              "DROP TRIGGER test_inventory_result_failure ON inventory_units; DROP FUNCTION test_inventory_result_failure()",
            );
          }
        },
      );

      await t.test(
        "completion/JSON serialization failure cannot commit a unit without a replay result",
        async () => {
          const ctx = attempt(a);
          await database.query(`CREATE FUNCTION test_inventory_completion_failure() RETURNS trigger AS $$ BEGIN IF NEW.scope LIKE 'inventory.unit.create:%' AND NEW.key = '${ctx.idempotencyKey}' THEN RAISE EXCEPTION 'fixture completion failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
          CREATE TRIGGER test_inventory_completion_failure BEFORE UPDATE ON idempotency_keys FOR EACH ROW EXECUTE FUNCTION test_inventory_completion_failure();`);
          try {
            await assert.rejects(
              command.execute(
                { code: "completion_fail", name: "Completion", precision: 6, dimension: "COUNT" },
                ctx,
              ),
            );
            await absent(db, a, "completion_fail", ctx.idempotencyKey);
          } finally {
            await database.query(
              "DROP TRIGGER test_inventory_completion_failure ON idempotency_keys; DROP FUNCTION test_inventory_completion_failure()",
            );
          }
          const key = `serialization:${randomUUID()}`;
          await assert.rejects(
            db.$transaction(async (tx) =>
              runTransactionalWorkspaceCommand(
                tx,
                {
                  tenantId: a.tenantId,
                  scope: scopeOf(a),
                  key,
                  requestHash: "a".repeat(64),
                  responseStatus: 201,
                },
                () => undefined,
                async () => {
                  await tx.inventoryUnit.create({
                    data: {
                      tenantId: a.tenantId,
                      code: "serialization_fail",
                      name: "Serialization",
                      precision: 6,
                      dimension: "COUNT",
                    },
                  });
                  return undefined;
                },
              ),
            ),
            (error) => error.code === "IDEMPOTENCY_RESULT_UNAVAILABLE",
          );
          await absent(db, a, "serialization_fail", key);
        },
      );

      await t.test(
        "uncertain/expired/corrupt saved results fail closed without executing a new mutation",
        async () => {
          const ctx = attempt(a);
          const body = { code: "blocked", name: "Blocked", precision: 6, dimension: "COUNT" };
          const result = await command.execute(body, ctx);
          const record = await db.idempotencyKey.findFirstOrThrow({
            where: { tenantId: a.tenantId, scope: scopeOf(a), key: ctx.idempotencyKey },
          });
          const foreign = await command.execute(
            { code: "foreign", name: "Foreign", precision: 6, dimension: "COUNT" },
            attempt(b),
          );
          const unitsBefore = await db.inventoryUnit.count();
          const auditsBefore = await db.auditLog.count();
          for (const [data, expected] of [
            [{ status: "PENDING" }, "IDEMPOTENCY_IN_PROGRESS"],
            [{ status: "FAILED" }, "IDEMPOTENCY_FAILED"],
            [{ expiresAt: new Date(0) }, "IDEMPOTENCY_EXPIRED"],
            [{ responseStatus: null }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, balance: "0" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, name: "Other" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, dimension: null } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, dimension: "MASS" } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ responseBody: { ...result, id: foreign.id } }, "IDEMPOTENCY_RESULT_UNAVAILABLE"],
            [{ requestHash: null }, "IDEMPOTENCY_KEY_REUSED"],
          ]) {
            await db.idempotencyKey.update({ where: { id: record.id }, data });
            await denied(command.execute(body, ctx), expected);
            await db.idempotencyKey.update({
              where: { id: record.id },
              data: {
                status: "COMPLETED",
                expiresAt: new Date(Date.now() + 86_400_000),
                responseStatus: 201,
                responseBody: result,
                requestHash: record.requestHash,
              },
            });
          }
          assert.equal(await db.inventoryUnit.count(), unitsBefore);
          assert.equal(await db.auditLog.count(), auditsBefore);
        },
      );

      await t.test(
        "internal missing scope cannot become an unscoped write, and Inventory stays standalone/unregistered",
        async () => {
          await assert.rejects(
            writer.create(
              { tenantId: undefined, actorId: a.userId },
              { code: "bad", name: "Bad", precision: 6, dimension: "COUNT" },
              attempt(a),
            ),
          );
          await assert.rejects(
            writer.create(
              { tenantId: a.tenantId, actorId: undefined },
              { code: "bad", name: "Bad", precision: 6, dimension: "COUNT" },
              attempt(a),
            ),
          );
          assert.equal(await db.inventoryUnit.count({ where: { code: "bad" } }), 0);
          assert.equal(await db.outboxEvent.count(), outboxBefore);
          for (const delegate of [
            db.coreModuleInstallation,
            db.catalogProduct,
            db.order,
            db.kdsTicket,
          ])
            assert.equal(await delegate.count({ where: { tenantId: a.tenantId } }), 0);
        },
      );
    } finally {
      await db.$disconnect();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
