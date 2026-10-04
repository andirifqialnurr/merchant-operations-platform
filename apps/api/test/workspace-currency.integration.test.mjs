import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { PrismaCatalogRepository } from "../src/catalog/catalog.repository.ts";
import {
  CurrencyLockedError,
  PrismaOrganizationRepository,
} from "../src/core/workspaces/organization.repository.ts";

const product = (categoryId, slug) => ({
  availability: "AVAILABLE",
  basePriceMinor: "0",
  categoryId,
  name: slug,
  slug,
});

async function workspace(db, slug) {
  const tenant = await db.tenant.create({ data: { name: slug, slug } });
  const category = await db.catalogCategory.create({
    data: { name: "Minuman", slug: "minuman", tenantId: tenant.id },
  });
  return { categoryId: category.id, currency: tenant.currency.trim(), id: tenant.id };
}

test("the currency of a workspace changes only before its first amount, atomically", async () => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const organization = new PrismaOrganizationRepository();
      const catalog = new PrismaCatalogRepository();
      const first = await workspace(db, "kopi-rupiah");
      const second = await workspace(db, "kopi-dollar");
      assert.equal(first.currency, "IDR");

      // Before any amount: the choice is saved and audited with before and after.
      const dollars = await organization.updateTenant(second.id, { currency: "USD" });
      assert.equal(dollars.currency.trim(), "USD");
      const audit = await database.query(
        "SELECT metadata FROM audit_logs WHERE tenant_id = $1 AND action = 'tenant.update'",
        [second.id],
      );
      const trail = JSON.stringify(audit.rows[0].metadata);
      assert.equal(trail.includes('"currency":"IDR"') && trail.includes('"currency":"USD"'), true);

      // A product is priced in the currency of its own workspace.
      const priced = await catalog.createProduct(second.id, product(second.categoryId, "latte"));
      assert.equal(priced.currency.trim(), "USD");

      // A zero price locks, and nothing of the refused request is saved.
      await assert.rejects(
        organization.updateTenant(second.id, { currency: "IDR", name: "Renamed" }),
        CurrencyLockedError,
      );
      const kept = await db.tenant.findUniqueOrThrow({ where: { id: second.id } });
      assert.deepEqual([kept.name, kept.currency.trim()], ["kopi-dollar", "USD"]);
      // Deactivating the product does not unlock.
      await db.catalogProduct.updateMany({
        data: { status: "INACTIVE" },
        where: { tenantId: second.id },
      });
      await assert.rejects(
        organization.updateTenant(second.id, { currency: "IDR" }),
        CurrencyLockedError,
      );
      // The other workspace is not touched by any of it and can still choose.
      assert.equal((await organization.getSnapshot(first.id)).hasMoneyData, false);
      assert.equal((await organization.getSnapshot(second.id)).hasMoneyData, true);

      // A first price and a currency change at the same moment: whichever
      // order they land in, the product and the workspace agree.
      const outcomes = new Set();
      for (let round = 0; round < 8; round += 1) {
        const racing = await workspace(db, `balapan-${round}`);
        const [created, changed] = await Promise.allSettled([
          catalog.createProduct(racing.id, product(racing.categoryId, "espresso")),
          organization.updateTenant(racing.id, { currency: "USD" }),
        ]);
        assert.equal(created.status, "fulfilled");
        const tenant = await db.tenant.findUniqueOrThrow({ where: { id: racing.id } });
        const made = await db.catalogProduct.findFirstOrThrow({ where: { tenantId: racing.id } });
        assert.equal(
          made.currency,
          tenant.currency,
          `round ${round}: a product must carry the currency of its workspace`,
        );
        if (changed.status === "rejected") {
          assert.ok(changed.reason instanceof CurrencyLockedError);
          assert.equal(tenant.currency.trim(), "IDR");
        } else {
          assert.equal(tenant.currency.trim(), "USD");
        }
        outcomes.add(tenant.currency.trim());
      }
      assert.ok(outcomes.size >= 1);

      // An option of a modifier carries an amount too, without any product.
      const options = await workspace(db, "hanya-pilihan");
      const group = await db.catalogModifierGroup.create({
        data: { name: "Gula", tenantId: options.id },
      });
      // A group has no amount; an option does, even a free one.
      assert.equal((await organization.getSnapshot(options.id)).hasMoneyData, false);
      await db.catalogModifierOption.create({
        data: { groupId: group.id, name: "Normal", tenantId: options.id },
      });
      assert.equal((await organization.getSnapshot(options.id)).hasMoneyData, true);
      await assert.rejects(
        organization.updateTenant(options.id, { currency: "USD" }),
        CurrencyLockedError,
      );
    } finally {
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
