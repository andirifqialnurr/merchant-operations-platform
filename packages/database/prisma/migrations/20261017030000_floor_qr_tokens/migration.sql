-- QR codes of tables (M4-BE-04). The token in a QR is never stored: only its
-- SHA-256 hash, to find it, and a random salt from which the server, with a
-- secret only it knows, can work the same token out again to reprint the QR.
-- Rotating makes a new version; the old token stops working at once.
CREATE TYPE "FloorQrTokenStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED');

CREATE TABLE "floor_qr_tokens" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "table_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "salt" CHAR(32) NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "status" "FloorQrTokenStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotated_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  CONSTRAINT "floor_qr_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "floor_qr_tokens_table_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id", "table_id")
    REFERENCES "floor_service_tables"("tenant_id", "outlet_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_qr_tokens_version_check" CHECK ("version" >= 1),
  CONSTRAINT "floor_qr_tokens_rotated_check"
    CHECK (("status" = 'ROTATED') = ("rotated_at" IS NOT NULL)),
  CONSTRAINT "floor_qr_tokens_revoked_check"
    CHECK (("status" = 'REVOKED') = ("revoked_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "floor_qr_tokens_token_hash_key" ON "floor_qr_tokens"("token_hash");
CREATE UNIQUE INDEX "floor_qr_tokens_table_version_key"
  ON "floor_qr_tokens"("tenant_id", "table_id", "version");
-- A table has at most one QR that works.
CREATE UNIQUE INDEX "floor_qr_tokens_active_key"
  ON "floor_qr_tokens"("tenant_id", "table_id") WHERE "status" = 'ACTIVE';
