-- A module a tenant is entitled to still has to be installed before it can be
-- used (architecture.md 6.1). The installation keeps its place when the module
-- is suspended or uninstalled, so switching it back on reuses the same row and
-- the module's data.

CREATE TYPE "ModuleInstallationStatus" AS ENUM (
  'NOT_INSTALLED',
  'PROVISIONING',
  'SETUP_REQUIRED',
  'ACTIVE',
  'ERROR',
  'SUSPENDED'
);

CREATE TABLE "core_module_installations" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "module_key" VARCHAR(80) NOT NULL,
  "status" "ModuleInstallationStatus" NOT NULL,
  "config_schema_version" INTEGER NOT NULL DEFAULT 1,
  "provisioned_at" TIMESTAMPTZ(6),
  "activated_at" TIMESTAMPTZ(6),
  "setup_required_reason" VARCHAR(500),
  "error_message" VARCHAR(500),
  "suspended_reason" VARCHAR(500),
  -- A merchant user or a platform user, so there is no foreign key.
  "actor_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_module_installations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_module_installations_config_schema_version_check"
    CHECK ("config_schema_version" >= 1),
  -- Each status carries the fact that explains it.
  CONSTRAINT "core_module_installations_active_check"
    CHECK ("status" <> 'ACTIVE' OR "activated_at" IS NOT NULL),
  CONSTRAINT "core_module_installations_setup_check"
    CHECK ("status" <> 'SETUP_REQUIRED' OR "setup_required_reason" IS NOT NULL),
  CONSTRAINT "core_module_installations_error_check"
    CHECK ("status" <> 'ERROR' OR "error_message" IS NOT NULL),
  CONSTRAINT "core_module_installations_suspended_check"
    CHECK ("status" <> 'SUSPENDED' OR "suspended_reason" IS NOT NULL),
  CONSTRAINT "core_module_installations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "core_module_installations_module_key_fkey"
    FOREIGN KEY ("module_key") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "core_module_installations_tenant_id_module_key_key"
  ON "core_module_installations"("tenant_id", "module_key");
CREATE UNIQUE INDEX "core_module_installations_tenant_id_id_key"
  ON "core_module_installations"("tenant_id", "id");
CREATE INDEX "core_module_installations_module_key_status_idx"
  ON "core_module_installations"("module_key", "status");

-- The module's settings for this tenant, validated by the module's own schema.
-- One row per schema version, so an upgrade keeps the previous settings.
CREATE TABLE "core_module_configs" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "installation_id" UUID NOT NULL,
  "schema_version" INTEGER NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_module_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_module_configs_schema_version_check" CHECK ("schema_version" >= 1),
  CONSTRAINT "core_module_configs_config_check" CHECK (jsonb_typeof("config") = 'object'),
  CONSTRAINT "core_module_configs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  -- A config can only belong to an installation of the same tenant.
  CONSTRAINT "core_module_configs_tenant_id_installation_id_fkey"
    FOREIGN KEY ("tenant_id", "installation_id")
    REFERENCES "core_module_installations"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "core_module_configs_installation_id_schema_version_key"
  ON "core_module_configs"("installation_id", "schema_version");
CREATE INDEX "core_module_configs_tenant_id_installation_id_idx"
  ON "core_module_configs"("tenant_id", "installation_id");

-- Until now "entitled" meant "usable". Keep that true for what tenants already
-- use: POS, the only commercial module that exists in code today, starts as an
-- active installation wherever the current subscription's package version or
-- an override still in force gives it. Modules that are entitled but not built
-- yet stay uninstalled and are installed when they are released.
INSERT INTO "core_module_installations"
  ("tenant_id", "module_key", "status", "provisioned_at", "activated_at")
SELECT DISTINCT entitled."tenant_id", entitled."module_key",
  'ACTIVE'::"ModuleInstallationStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT s."tenant_id", pm."module_key"
  FROM "subscriptions" s
  JOIN "core_package_modules" pm ON pm."package_version_id" = s."package_version_id"
  WHERE s."superseded_at" IS NULL
  UNION
  SELECT o."tenant_id", o."target_key"
  FROM "core_entitlement_overrides" o
  WHERE o."target_type" = 'MODULE'
    AND o."operation" = 'GRANT'
    AND (o."ends_at" IS NULL OR o."ends_at" > CURRENT_TIMESTAMP)
) entitled
JOIN "modules" m ON m."key" = entitled."module_key"
WHERE m."kind" = 'COMMERCIAL' AND m."key" IN ('POS');

INSERT INTO "core_module_configs" ("tenant_id", "installation_id", "schema_version")
SELECT "tenant_id", "id", "config_schema_version" FROM "core_module_installations";
