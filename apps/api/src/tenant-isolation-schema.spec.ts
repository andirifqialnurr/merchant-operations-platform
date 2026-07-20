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
