CREATE TYPE "OrganizationUnitStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "tenants"
  ADD COLUMN "status" "OrganizationUnitStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "brands"
  ADD COLUMN "status" "OrganizationUnitStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "outlets"
  ADD COLUMN "status" "OrganizationUnitStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE UNIQUE INDEX "brands_tenant_id_id_key" ON "brands"("tenant_id", "id");

ALTER TABLE "outlets" DROP CONSTRAINT "outlets_brand_id_fkey";

ALTER TABLE "outlets"
  ADD CONSTRAINT "outlets_tenant_id_brand_id_fkey"
  FOREIGN KEY ("tenant_id", "brand_id") REFERENCES "brands"("tenant_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ALTER COLUMN "outlet_id" DROP NOT NULL;
ALTER TABLE "idempotency_keys" ALTER COLUMN "outlet_id" SET NOT NULL;
