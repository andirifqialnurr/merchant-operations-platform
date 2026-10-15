-- External systems that send tickets to a kitchen (M3-BE-08). One source is
-- one secret key, bound to one outlet. Only a hash of the secret is kept; the
-- key is shown once, when the source is created.
CREATE TYPE "KdsIntakeSourceStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "kds_intake_sources" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  -- The public part of the key, used to find the source.
  "key_prefix" VARCHAR(16) NOT NULL,
  "secret_hash" CHAR(64) NOT NULL,
  "status" "KdsIntakeSourceStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by" UUID,
  "last_used_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kds_intake_sources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kds_intake_sources_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kds_intake_sources_outlet_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kds_intake_sources_revoked_check"
    CHECK (("status" = 'REVOKED') = ("revoked_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "kds_intake_sources_key_prefix_key" ON "kds_intake_sources"("key_prefix");
CREATE UNIQUE INDEX "kds_intake_sources_tenant_id_id_key" ON "kds_intake_sources"("tenant_id", "id");
CREATE INDEX "kds_intake_sources_tenant_status_idx"
  ON "kds_intake_sources"("tenant_id", "status");

-- Active sources count against the package (KDS Basic: 1).
INSERT INTO "core_usage_dimensions" ("key", "unit", "enforcement") VALUES
  ('kds.intake_sources.active', 'count', 'HARD_COUNT')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "permissions" ("key", "description") VALUES
  ('kds.intake.manage', 'Create and revoke the keys external systems use to send kitchen tickets')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_key")
SELECT r."tenant_id", r."id", 'kds.intake.manage'
FROM "roles" r
WHERE r."is_system" = TRUE AND r."code" IN ('OWNER', 'MANAGER')
ON CONFLICT DO NOTHING;
