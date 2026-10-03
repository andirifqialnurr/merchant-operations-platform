-- A binding is the switch between two modules for one workspace: "when module
-- A announces this event, module B reacts with this handler" (architecture.md
-- 6.2). The dispatcher only calls a cross-module handler through an active
-- binding. Reactions inside one module need no binding.

CREATE TYPE "IntegrationBindingStatus" AS ENUM (
  'DRAFT',
  'SETUP_REQUIRED',
  'ACTIVE',
  'PAUSED',
  'ERROR',
  'DISABLED'
);
CREATE TYPE "IntegrationBindingHealth" AS ENUM ('HEALTHY', 'STALE', 'BLOCKED');

CREATE TABLE "core_integration_bindings" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "source_module_key" VARCHAR(80) NOT NULL,
  "event_type" VARCHAR(160) NOT NULL,
  "event_version" INTEGER NOT NULL DEFAULT 1,
  "target_module_key" VARCHAR(80) NOT NULL,
  "handler_key" VARCHAR(120) NOT NULL,
  "status" "IntegrationBindingStatus" NOT NULL,
  "health" "IntegrationBindingHealth" NOT NULL DEFAULT 'HEALTHY',
  "config_schema_version" INTEGER NOT NULL DEFAULT 1,
  -- How source data maps onto the target, validated by the target module.
  "config" JSONB NOT NULL DEFAULT '{}',
  -- Events that occurred before this moment are not delivered: adding a module
  -- never processes old data on its own.
  "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effective_to" TIMESTAMPTZ(6),
  -- A reason that is safe to show: no payload, no secrets.
  "last_error" VARCHAR(500),
  -- Why a person changed the status last.
  "audit_reason" VARCHAR(500),
  "actor_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_integration_bindings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_integration_bindings_modules_check"
    CHECK ("source_module_key" <> "target_module_key"),
  CONSTRAINT "core_integration_bindings_event_version_check" CHECK ("event_version" >= 1),
  CONSTRAINT "core_integration_bindings_config_check" CHECK (jsonb_typeof("config") = 'object'),
  CONSTRAINT "core_integration_bindings_period_check"
    CHECK ("effective_to" IS NULL OR "effective_to" > "effective_from"),
  CONSTRAINT "core_integration_bindings_error_check"
    CHECK ("status" <> 'ERROR' OR "last_error" IS NOT NULL),
  CONSTRAINT "core_integration_bindings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "core_integration_bindings_source_module_key_fkey"
    FOREIGN KEY ("source_module_key") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "core_integration_bindings_target_module_key_fkey"
    FOREIGN KEY ("target_module_key") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- One binding per pair of modules, event, and handler in a workspace.
CREATE UNIQUE INDEX "core_integration_bindings_route_key"
  ON "core_integration_bindings"
  ("tenant_id", "source_module_key", "event_type", "target_module_key", "handler_key");
CREATE INDEX "core_integration_bindings_tenant_id_target_module_key_idx"
  ON "core_integration_bindings"("tenant_id", "target_module_key");
CREATE INDEX "core_integration_bindings_tenant_id_status_idx"
  ON "core_integration_bindings"("tenant_id", "status");
