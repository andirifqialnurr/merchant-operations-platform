import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { PrismaCatalogRepository } from "../src/kernels/catalog/adapters/prisma-catalog.repository.ts";
import { PrismaOrganizationRepository } from "../src/core/workspaces/organization.repository.ts";

/** One business with a brand, an outlet, a category, a product, and a member with a role. */
async function business(db, slug) {
  const tenant = await db.tenant.create({ data: { name: slug, slug } });
  const tenantId = tenant.id;
  const brand = await db.brand.create({ data: { name: "Brand", slug: "brand", tenantId } });
  const outlet = await db.outlet.create({
    data: { brandId: brand.id, code: "PUSAT", name: "Pusat", tenantId },
  });
  const category = await db.catalogCategory.create({
    data: { name: "Minuman", slug: "minuman", tenantId },
  });
  const product = await db.catalogProduct.create({
    data: {
      basePriceMinor: 25_000n,
      categoryId: category.id,
      name: "Kopi",
      slug: "kopi",
      tenantId,
    },
  });
  const user = await db.user.create({
    data: { displayName: slug, email: `${slug}@example.com`, passwordHash: "x" },
  });
  const membership = await db.tenantMembership.create({ data: { tenantId, userId: user.id } });
  const role = await db.role.create({ data: { code: "KASIR", name: "Kasir", tenantId } });
  return { brand, category, membership, outlet, product, role, tenantId, user };
}

/** The database itself refuses the write, whatever the application does. */
async function refused(write, what) {
  await assert.rejects(write, (error) => {
    const text = `${error.code ?? ""} ${error.message}`;
    assert.match(text, /P2003|P2002|P2004|23503|23505|23514|constraint/i, what);
    return true;
  });
}

test("PostgreSQL keeps the rows of one business apart from another", async () => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const a = await business(db, "kopi-a");
      const b = await business(db, "kopi-b");

      // The same names, slugs, and codes live side by side in two businesses.
      assert.equal(a.product.slug, b.product.slug);
      assert.equal(a.outlet.code, b.outlet.code);
      assert.equal(a.role.code, b.role.code);

      // A row of one business cannot point at a row of the other: every
      // reference carries the business with it.
      await refused(
        db.outlet.create({
          data: { brandId: b.brand.id, code: "CABANG", name: "Cabang", tenantId: a.tenantId },
        }),
        "an outlet under another business's brand",
      );
      await refused(
        db.catalogProduct.create({
          data: {
            basePriceMinor: 1n,
            categoryId: b.category.id,
            name: "Teh",
            slug: "teh",
            tenantId: a.tenantId,
          },
        }),
        "a product in another business's category",
      );
      await refused(
        db.catalogOutletProduct.create({
          data: { outletId: a.outlet.id, productId: b.product.id, tenantId: a.tenantId },
        }),
        "another business's product sold at an outlet",
      );
      await refused(
        db.catalogOutletProduct.create({
          data: { outletId: b.outlet.id, productId: a.product.id, tenantId: a.tenantId },
        }),
        "a product sold at another business's outlet",
      );
      await refused(
        db.outletAssignment.create({
          data: { membershipId: a.membership.id, outletId: b.outlet.id, tenantId: a.tenantId },
        }),
        "a member assigned to another business's outlet",
      );
      await refused(
        db.userRole.create({
          data: { membershipId: a.membership.id, roleId: b.role.id, tenantId: a.tenantId },
        }),
        "a member given another business's role",
      );

      // Inside one business, duplicates are refused.
      await refused(
        db.catalogProduct.create({
          data: {
            basePriceMinor: 1n,
            categoryId: a.category.id,
            name: "Kopi lagi",
            slug: "kopi",
            tenantId: a.tenantId,
          },
        }),
        "two products with one slug",
      );
      await refused(
        db.outlet.create({
          data: { brandId: a.brand.id, code: "PUSAT", name: "Pusat 2", tenantId: a.tenantId },
        }),
        "two outlets with one code",
      );
      await refused(
        db.tenantMembership.create({ data: { tenantId: a.tenantId, userId: a.user.id } }),
        "one person twice in a business",
      );

      // Amounts and settings that make no sense never reach a table.
      await refused(
        database.query("UPDATE products SET base_price_minor = -1 WHERE id = $1", [a.product.id]),
        "a negative price",
      );
      await refused(
        database.query("UPDATE tenants SET currency = 'rp' WHERE id = $1", [a.tenantId]),
        "a currency that is not three capital letters",
      );
      await refused(
        database.query("UPDATE outlets SET tax_rate_bp = 5001 WHERE id = $1", [a.outlet.id]),
        "a tax rate above 50%",
      );
      await refused(
        database.query("UPDATE tenants SET type = 'PERSONAL', template = 'CAFE' WHERE id = $1", [
          a.tenantId,
        ]),
        "a personal workspace with a business template",
      );

      // Nothing above left a trace.
      const counts = await database.query(
        `SELECT (SELECT count(*)::int FROM outlets) AS outlets,
                (SELECT count(*)::int FROM products) AS products,
                (SELECT count(*)::int FROM outlet_products) AS outlet_products,
                (SELECT count(*)::int FROM outlet_assignments) AS assignments`,
      );
      assert.deepEqual(counts.rows[0], {
        assignments: 0,
        outlet_products: 0,
        outlets: 2,
        products: 2,
      });

      // Repositories asked for another business's row by its ID answer as if it did not exist.
      const organization = new PrismaOrganizationRepository();
      const catalog = new PrismaCatalogRepository();
      assert.equal(await organization.findOutletById(a.tenantId, b.outlet.id), null);
      assert.equal(await organization.findBrandById(a.tenantId, b.brand.id), null);
      assert.equal(await catalog.findProductById(a.tenantId, b.product.id), null);
      assert.equal(await catalog.findCategoryById(a.tenantId, b.category.id), null);
      assert.equal((await organization.findOutletById(a.tenantId, a.outlet.id))?.id, a.outlet.id);
      const snapshot = await organization.getSnapshot(a.tenantId);
      assert.deepEqual(
        [snapshot.brands.map((item) => item.id), snapshot.outlets.map((item) => item.id)],
        [[a.brand.id], [a.outlet.id]],
      );
      const menu = await catalog.getSnapshot(a.tenantId);
      assert.deepEqual(
        menu.products.map((item) => item.id),
        [a.product.id],
      );

      // A write aimed at another business's row changes nothing.
      await assert.rejects(organization.updateOutlet(a.tenantId, b.outlet.id, { name: "Dicuri" }));
      const untouched = await db.outlet.findUniqueOrThrow({ where: { id: b.outlet.id } });
      assert.equal(untouched.name, "Pusat");
    } finally {
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
