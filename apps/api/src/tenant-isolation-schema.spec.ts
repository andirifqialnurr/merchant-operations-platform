import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(
  new URL("../../../packages/database/prisma/schema.prisma", import.meta.url),
  "utf8",
);
const organizationMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260718123000_organization_registry_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const accessMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260718140000_access_control_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const entitlementMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260720120000_subscription_entitlement_core/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const platformMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260720160000_platform_owner_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const catalogMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260720180000_catalog_category_product_core/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const catalogCompositionMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260720190000_catalog_product_composition/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const catalogOutletMigration = readFileSync(
  new URL(
    "../../../packages/database/prisma/migrations/20260720200000_catalog_outlet_overrides/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("keeps organization and access relations scoped by tenant composite keys", () => {
  assert.match(
    schema,
    /brand\s+Brand\s+@relation\(fields: \[tenantId, brandId\], references: \[tenantId, id\]/,
  );
  assert.match(
    schema,
    /membership\s+TenantMembership\s+@relation\(fields: \[tenantId, membershipId\], references: \[tenantId, id\]/,
  );
  assert.match(
    schema,
    /role\s+Role\s+@relation\(fields: \[tenantId, roleId\], references: \[tenantId, id\]/,
  );
  assert.match(
    schema,
    /outlet\s+Outlet\s+@relation\(fields: \[tenantId, outletId\], references: \[tenantId, id\]/,
  );
  assert.match(
    organizationMigration,
    /FOREIGN KEY \("tenant_id", "brand_id"\) REFERENCES "brands"\("tenant_id", "id"\)/,
  );
  assert.match(
    accessMigration,
    /FOREIGN KEY \("tenant_id", "membership_id"\) REFERENCES "tenant_memberships"\("tenant_id", "id"\)/,
  );
});

test("keeps current subscription and entitlement overrides isolated per tenant", () => {
  assert.match(schema, /@@unique\(\[tenantId, moduleKey\]\)/);
  assert.match(
    entitlementMigration,
    /CREATE UNIQUE INDEX "subscriptions_current_tenant_key" ON "subscriptions"\("tenant_id"\) WHERE "superseded_at" IS NULL/,
  );
  assert.match(
    entitlementMigration,
    /CREATE UNIQUE INDEX "tenant_entitlements_tenant_id_module_key_key" ON "tenant_entitlements"\("tenant_id", "module_key"\)/,
  );
  assert.match(
    entitlementMigration,
    /FOREIGN KEY \("tenant_id"\) REFERENCES "tenants"\("id"\) ON DELETE RESTRICT/,
  );
});

test("keeps platform identities and sessions separate from tenant identities", () => {
  assert.match(schema, /model PlatformUser[\s\S]*@@map\("platform_users"\)/);
  assert.match(schema, /model PlatformLoginSession[\s\S]*@@map\("platform_login_sessions"\)/);
  assert.match(platformMigration, /CREATE TABLE "platform_users"/);
  assert.match(platformMigration, /CREATE TABLE "platform_login_sessions"/);
  assert.match(
    platformMigration,
    /FOREIGN KEY \("user_id"\) REFERENCES "platform_users"\("id"\) ON DELETE CASCADE/,
  );
});

test("keeps catalog products scoped to their tenant category and exact non-negative price", () => {
  assert.match(
    schema,
    /category\s+CatalogCategory\s+@relation\(fields: \[tenantId, categoryId\], references: \[tenantId, id\]/,
  );
  assert.match(
    catalogMigration,
    /FOREIGN KEY \("tenant_id", "category_id"\) REFERENCES "categories"\("tenant_id", "id"\)/,
  );
  assert.match(
    catalogMigration,
    /CONSTRAINT "products_base_price_minor_check" CHECK \("base_price_minor" >= 0\)/,
  );
  assert.match(catalogMigration, /'catalog\.manage', 'Manage tenant catalog'/);
});

test("keeps product composition parents tenant-scoped and composition prices non-negative", () => {
  assert.match(
    schema,
    /product\s+CatalogProduct\s+@relation\(fields: \[tenantId, productId\], references: \[tenantId, id\]/,
  );
  assert.match(
    schema,
    /modifierGroup\s+CatalogModifierGroup\s+@relation\(fields: \[tenantId, modifierGroupId\], references: \[tenantId, id\]/,
  );
  assert.match(
    catalogCompositionMigration,
    /FOREIGN KEY \("tenant_id", "product_id"\) REFERENCES "products"\("tenant_id", "id"\)/,
  );
  assert.match(
    catalogCompositionMigration,
    /FOREIGN KEY \("tenant_id", "modifier_group_id"\) REFERENCES "modifier_groups"\("tenant_id", "id"\)/,
  );
  assert.match(
    catalogCompositionMigration,
    /CONSTRAINT "modifier_groups_single_selection_check" CHECK/,
  );
  assert.match(
    catalogCompositionMigration,
    /CONSTRAINT "product_variants_price_delta_minor_check" CHECK \("price_delta_minor" >= 0\)/,
  );
  assert.match(
    catalogCompositionMigration,
    /CREATE UNIQUE INDEX "product_images_active_primary_product_key"[\s\S]*WHERE "is_primary" = TRUE AND "status" = 'ACTIVE'/,
  );
});

test("keeps outlet catalog assignments scoped to both outlet and product tenant keys", () => {
  assert.match(
    schema,
    /outlet\s+Outlet\s+@relation\(fields: \[tenantId, outletId\], references: \[tenantId, id\]/,
  );
  assert.match(
    catalogOutletMigration,
    /FOREIGN KEY \("tenant_id", "outlet_id"\) REFERENCES "outlets"\("tenant_id", "id"\)/,
  );
  assert.match(
    catalogOutletMigration,
    /FOREIGN KEY \("tenant_id", "product_id"\) REFERENCES "products"\("tenant_id", "id"\)/,
  );
  assert.match(
    catalogOutletMigration,
    /CREATE UNIQUE INDEX "outlet_products_tenant_id_outlet_id_product_id_key"/,
  );
  assert.match(
    catalogOutletMigration,
    /CONSTRAINT "outlet_products_price_override_minor_check" CHECK \([\s\S]*"price_override_minor" IS NULL OR "price_override_minor" >= 0/,
  );
});
