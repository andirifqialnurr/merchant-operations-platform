-- What each tenant can use right now, one row per enabled module (schema.md
-- B.2). A projection: it is rebuilt from the subscription, its package
-- version, and the overrides whenever one of them changes, and can be thrown
-- away and rebuilt at any time (`pnpm --filter @merchant/api entitlements:rebuild`).
-- Access decisions do not read it; they evaluate the sources directly, because
-- subscriptions and overrides also change with time.

CREATE TABLE "core_effective_entitlements" (
  "tenant_id" UUID NOT NULL,
  "module_key" VARCHAR(80) NOT NULL,
  "tier" "ModuleTier" NOT NULL,
  -- Capability keys owned by this module: ["pos.split_bill", ...]
  "capabilities" JSONB NOT NULL DEFAULT '[]',
  -- [{ "dimensionKey": "...", "unlimited": false, "value": "3", "source": "PACKAGE" }]
  "limits" JSONB NOT NULL DEFAULT '[]',
  "computed_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "core_effective_entitlements_pkey" PRIMARY KEY ("tenant_id", "module_key"),
  CONSTRAINT "core_effective_entitlements_capabilities_check"
    CHECK (jsonb_typeof("capabilities") = 'array'),
  CONSTRAINT "core_effective_entitlements_limits_check"
    CHECK (jsonb_typeof("limits") = 'array'),
  CONSTRAINT "core_effective_entitlements_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "core_effective_entitlements_module_key_fkey"
    FOREIGN KEY ("module_key") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "core_effective_entitlements_module_key_idx"
  ON "core_effective_entitlements"("module_key");
