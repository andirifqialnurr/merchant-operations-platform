import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { PrismaApprovalPinRepository } from "../src/core/memberships/approval-pin.repository.ts";

test("wrong tries on an approval PIN are counted in the database, even at the same moment", async () => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const pins = new PrismaApprovalPinRepository();
      const tenant = await db.tenant.create({ data: { name: "Kopi", slug: "kopi" } });
      const other = await db.tenant.create({ data: { name: "Lain", slug: "lain" } });
      const user = await db.user.create({
        data: { displayName: "Bu Rina", email: "rina@example.com", passwordHash: "x" },
      });
      const audit = { userId: user.id };
      await pins.save(tenant.id, user.id, "hash-a", { ...audit, action: "approval_pin.set" });
      await pins.save(other.id, user.id, "hash-b", { ...audit, action: "approval_pin.set" });
      const lockUntil = new Date(Date.now() + 60_000);

      // Four tries at once all count: none is lost to a race.
      const states = await Promise.all(
        Array.from({ length: 4 }, () =>
          pins.recordFailure(tenant.id, user.id, 5, lockUntil, audit),
        ),
      );
      assert.deepEqual(states.map((state) => state.failedAttempts).sort(), [1, 2, 3, 4]);
      assert.equal((await pins.find(tenant.id, user.id))?.lockedUntil, null);

      // The fifth locks, starts the count over, and is written to the audit trail.
      const fifth = await pins.recordFailure(tenant.id, user.id, 5, lockUntil, audit);
      assert.equal(fifth.failedAttempts, 0);
      assert.equal(fifth.lockedUntil?.getTime(), lockUntil.getTime());
      const locked = await database.query(
        "SELECT count(*)::int AS n FROM audit_logs WHERE action = 'approval_pin.locked' AND tenant_id = $1",
        [tenant.id],
      );
      assert.equal(locked.rows[0].n, 1);

      // The same person's PIN in another workspace is a different PIN.
      const elsewhere = await pins.find(other.id, user.id);
      assert.deepEqual(
        [elsewhere?.pinHash, elsewhere?.failedAttempts, elsewhere?.lockedUntil],
        ["hash-b", 0, null],
      );

      // Setting a new PIN clears the lock; removing it leaves nothing behind.
      await pins.save(tenant.id, user.id, "hash-c", { ...audit, action: "approval_pin.set" });
      assert.equal((await pins.find(tenant.id, user.id))?.lockedUntil, null);
      assert.equal(
        await pins.delete(tenant.id, user.id, { ...audit, action: "approval_pin.reset" }),
        true,
      );
      assert.equal(await pins.find(tenant.id, user.id), null);
      assert.equal(
        await pins.delete(tenant.id, user.id, { ...audit, action: "approval_pin.reset" }),
        false,
      );
      assert.deepEqual([...(await pins.userIdsWithPin(other.id))], [user.id]);
      await assert.rejects(database.query("UPDATE core_approval_pins SET failed_attempts = -1"), {
        code: "23514",
      });
    } finally {
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
