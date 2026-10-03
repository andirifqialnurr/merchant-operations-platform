-- Per-tenant exceptions to what the subscribed package gives (schema.md B.2).
-- Each row is one decision with a reason, a period, and who made it. Rows are
-- history: a new decision closes the previous one instead of overwriting it.
--
-- `tenant_entitlements` stays during the transition (SCH-03) but is no longer
-- written; its rows are copied here as module overrides.

-- MODULE keeps today's "switch a module on or off for this tenant".
CREATE TYPE "EntitlementOverrideTarget" AS ENUM ('MODULE', 'CAPABILITY', 'LIMIT');
CREATE TYPE "EntitlementOverrideOperation" AS ENUM ('GRANT', 'REVOKE', 'ADD', 'REPLACE');

CREATE TABLE "core_entitlement_overrides" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "target_type" "EntitlementOverrideTarget" NOT NULL,
  "target_key" VARCHAR(160) NOT NULL,
  "operation" "EntitlementOverrideOperation" NOT NULL,
  "value" BIGINT,
  "reason" VARCHAR(500) NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ends_at" TIMESTAMPTZ(6),
  -- A merchant user or a platform user, so there is no foreign key.
  "actor_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_entitlement_overrides_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_entitlement_overrides_reason_check" CHECK (char_length(btrim("reason")) >= 3),
  CONSTRAINT "core_entitlement_overrides_period_check"
    CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at"),
  -- Modules and capabilities are granted or revoked; limits are added to or replaced.
  CONSTRAINT "core_entitlement_overrides_operation_check" CHECK (
    ("target_type" IN ('MODULE', 'CAPABILITY') AND "operation" IN ('GRANT', 'REVOKE') AND "value" IS NULL)
    OR ("target_type" = 'LIMIT' AND "operation" IN ('ADD', 'REPLACE') AND "value" IS NOT NULL AND "value" >= 0)
  ),
  CONSTRAINT "core_entitlement_overrides_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "core_entitlement_overrides_tenant_id_target_type_target_key_idx"
  ON "core_entitlement_overrides"("tenant_id", "target_type", "target_key", "starts_at");
-- At most one open-ended decision per target, so "the current override" is never ambiguous.
CREATE UNIQUE INDEX "core_entitlement_overrides_open_ended_key"
  ON "core_entitlement_overrides"("tenant_id", "target_type", "target_key")
  WHERE "ends_at" IS NULL;

INSERT INTO "core_entitlement_overrides"
  ("tenant_id", "target_type", "target_key", "operation", "reason", "starts_at", "actor_id", "created_at")
SELECT
  "tenant_id",
  'MODULE',
  "module_key",
  CASE WHEN "enabled" THEN 'GRANT' ELSE 'REVOKE' END::"EntitlementOverrideOperation",
  "reason",
  "effective_at",
  "actor_id",
  "created_at"
FROM "tenant_entitlements";
