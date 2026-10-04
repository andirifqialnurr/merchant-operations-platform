-- Devices (security.md 12): a cashier tablet or a kitchen screen is registered
-- for one outlet, activated once with a short code, and from then on proves
-- itself with a credential of its own. The credential is separate from the
-- session of the person using the device and can be revoked on its own.

CREATE TYPE "DeviceMode" AS ENUM ('POS', 'KDS');
CREATE TYPE "DeviceStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

CREATE TABLE "core_devices" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "mode" "DeviceMode" NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "status" "DeviceStatus" NOT NULL DEFAULT 'PENDING',
  -- SHA-256 of the one-time activation code. Cleared when it is used.
  "activation_code_hash" CHAR(64),
  "activation_expires_at" TIMESTAMPTZ(6),
  -- SHA-256 of the device's secret. The secret itself is never stored.
  "credential_hash" CHAR(64),
  "activated_at" TIMESTAMPTZ(6),
  "last_seen_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "revoked_by" UUID,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_devices_label_check" CHECK (char_length(btrim("label")) >= 2),
  -- Each status holds exactly the secrets it needs and no others.
  CONSTRAINT "core_devices_pending_check" CHECK (
    "status" <> 'PENDING'
    OR ("activation_code_hash" IS NOT NULL AND "activation_expires_at" IS NOT NULL
        AND "credential_hash" IS NULL)
  ),
  CONSTRAINT "core_devices_active_check" CHECK (
    "status" <> 'ACTIVE'
    OR ("credential_hash" IS NOT NULL AND "activated_at" IS NOT NULL
        AND "activation_code_hash" IS NULL)
  ),
  CONSTRAINT "core_devices_revoked_check" CHECK (
    "status" <> 'REVOKED'
    OR ("credential_hash" IS NULL AND "activation_code_hash" IS NULL
        AND "revoked_at" IS NOT NULL)
  ),
  CONSTRAINT "core_devices_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  -- The outlet must belong to the same tenant as the device.
  CONSTRAINT "core_devices_tenant_id_outlet_id_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "core_devices_activation_code_hash_key"
  ON "core_devices"("activation_code_hash");
CREATE UNIQUE INDEX "core_devices_credential_hash_key" ON "core_devices"("credential_hash");
CREATE INDEX "core_devices_tenant_id_outlet_id_idx" ON "core_devices"("tenant_id", "outlet_id");
CREATE INDEX "core_devices_tenant_id_status_idx" ON "core_devices"("tenant_id", "status");

INSERT INTO "permissions" ("key", "description") VALUES
  ('device.read', 'See the devices of the business'),
  ('device.manage', 'Register and revoke devices')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_key")
SELECT "tenant_id", "id", 'device.read' FROM "roles"
WHERE "is_system" = TRUE AND "code" IN ('OWNER', 'MANAGER')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_key")
SELECT "tenant_id", "id", 'device.manage' FROM "roles"
WHERE "is_system" = TRUE AND "code" IN ('OWNER', 'MANAGER')
ON CONFLICT DO NOTHING;
