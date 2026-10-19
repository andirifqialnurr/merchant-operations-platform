import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";

test("moderation migration preserves legacy POS and guest order snapshots without emitting events", async () => {
  await withDisposablePostgres(async ({ database }) => {
    // Restore only the pre-checkpoint order shape inside this disposable database.
    await database.query(`ALTER TABLE order_orders DROP CONSTRAINT order_moderation_decision_check;
      DROP INDEX order_orders_tenant_id_outlet_id_moderation_status_created_at_idx;
      ALTER TABLE order_orders DROP COLUMN moderation_status, DROP COLUMN moderated_at, DROP COLUMN moderated_by;
      DROP TYPE "OrderModerationStatus";`);
    const tenant = randomUUID(),
      brand = randomUUID(),
      outlet = randomUUID();
    await database.query(
      `INSERT INTO tenants(id, name, slug, updated_at) VALUES ($1, 'Legacy', 'legacy', now())`,
      [tenant],
    );
    await database.query(
      `INSERT INTO brands(id, tenant_id, name, slug, updated_at) VALUES ($1, $2, 'Legacy', 'legacy', now())`,
      [brand, tenant],
    );
    await database.query(
      `INSERT INTO outlets(id, tenant_id, brand_id, code, name, updated_at) VALUES ($1, $2, $3, 'OLD', 'Legacy', now())`,
      [outlet, tenant, brand],
    );
    await database.query(
      `INSERT INTO order_orders(tenant_id, outlet_id, order_number, source, order_type, status, currency, submitted_at, idempotency_key, updated_at)
      VALUES ($1, $2, 1, 'POS', 'TAKEAWAY', 'COMPLETED', 'IDR', now(), 'legacy-pos', now()),
             ($1, $2, 2, 'SELF_ORDER', 'DINE_IN', 'PREPARING', 'IDR', now(), 'legacy-guest', now())`,
      [tenant, outlet],
    );
    const before = (
      await database.query(
        `SELECT to_jsonb(o) AS snapshot FROM order_orders o ORDER BY order_number`,
      )
    ).rows;
    const eventsBefore = (await database.query(`SELECT count(*) FROM outbox_events`)).rows;
    const migration = await readFile(
      new URL(
        "../../../packages/database/prisma/migrations/20261019010000_self_order_moderation/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await database.query(migration);
    const after = (
      await database.query(
        `SELECT to_jsonb(o) - 'moderation_status' - 'moderated_at' - 'moderated_by' AS snapshot FROM order_orders o ORDER BY order_number`,
      )
    ).rows;
    assert.deepEqual(after, before);
    assert.deepEqual(
      (
        await database.query(
          `SELECT moderation_status, moderated_at, moderated_by FROM order_orders ORDER BY order_number`,
        )
      ).rows,
      [
        { moderation_status: "NOT_REQUIRED", moderated_at: null, moderated_by: null },
        { moderation_status: "NOT_REQUIRED", moderated_at: null, moderated_by: null },
      ],
    );
    assert.deepEqual(
      (await database.query(`SELECT count(*) FROM outbox_events`)).rows,
      eventsBefore,
    );
  });
});
