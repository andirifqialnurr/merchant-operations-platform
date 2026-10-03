-- Adjustments to existing tables for the modular core (schema.md B.1).
-- Every new column is nullable or has a default, so existing rows stay valid.

-- Workspace kind and business template (PRD v2 section 6.4), plus the
-- workspace's default currency and time zone.
CREATE TYPE "WorkspaceType" AS ENUM ('BUSINESS', 'PERSONAL');
CREATE TYPE "BusinessTemplate" AS ENUM (
  'CAFE',
  'RESTAURANT',
  'BAKERY_RETAIL',
  'CLOUD_KITCHEN',
  'HC_ONLY',
  'BUSINESS_FINANCE_ONLY',
  'PERSONAL'
);

ALTER TABLE "tenants"
  ADD COLUMN "type" "WorkspaceType" NOT NULL DEFAULT 'BUSINESS',
  ADD COLUMN "template" "BusinessTemplate" NOT NULL DEFAULT 'CAFE',
  ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
  ADD COLUMN "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta';

ALTER TABLE "tenants" ADD CONSTRAINT "tenants_currency_check"
  CHECK ("currency" ~ '^[A-Z]{3}$');
-- A personal workspace uses the personal template and nothing else does.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_type_template_check"
  CHECK (("type" = 'PERSONAL') = ("template" = 'PERSONAL'));

ALTER TABLE "outlets" ADD COLUMN "address" VARCHAR(500);

-- Workspace-level commands (inviting a user, installing a module) have no
-- outlet. Uniqueness for those rows needs its own index because NULLs never
-- collide in the existing (tenant, outlet, scope, key) constraint.
ALTER TABLE "idempotency_keys" ALTER COLUMN "outlet_id" DROP NOT NULL;
CREATE UNIQUE INDEX "idempotency_keys_tenant_scope_key_without_outlet_key"
  ON "idempotency_keys" ("tenant_id", "scope", "key")
  WHERE "outlet_id" IS NULL;

-- Event envelope fields (contracts: domainEventEnvelopeSchema).
ALTER TABLE "outbox_events"
  ADD COLUMN "event_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "correlation_id" VARCHAR(100),
  ADD COLUMN "causation_id" UUID,
  ADD COLUMN "actor_type" VARCHAR(20),
  ADD COLUMN "actor_id" UUID,
  ADD COLUMN "producer" VARCHAR(80),
  ADD COLUMN "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_event_version_check"
  CHECK ("event_version" >= 1);
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_actor_type_check"
  CHECK ("actor_type" IS NULL OR "actor_type" IN ('DEVICE', 'INTEGRATION', 'SYSTEM', 'USER'));
-- Existing events were recorded when they occurred.
UPDATE "outbox_events" SET "recorded_at" = "occurred_at";

-- Where a command came from, why it was done, and the request chain it belongs to.
ALTER TABLE "audit_logs"
  ADD COLUMN "channel" VARCHAR(20),
  ADD COLUMN "reason" VARCHAR(500),
  ADD COLUMN "correlation_id" VARCHAR(100);

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_channel_check"
  CHECK ("channel" IS NULL OR "channel" IN ('API', 'IMPORT', 'KDS', 'MOBILE', 'POS', 'WEB'));
CREATE INDEX "audit_logs_tenant_id_correlation_id_idx"
  ON "audit_logs" ("tenant_id", "correlation_id");
