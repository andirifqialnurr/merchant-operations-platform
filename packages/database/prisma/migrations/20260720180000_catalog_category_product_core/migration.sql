CREATE TYPE "CatalogRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ProductAvailability" AS ENUM ('AVAILABLE', 'SOLD_OUT');

CREATE TABLE "categories" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "status" "CatalogRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "description" VARCHAR(2000),
  "base_price_minor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
  "availability" "ProductAvailability" NOT NULL DEFAULT 'AVAILABLE',
  "status" "CatalogRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_base_price_minor_check" CHECK ("base_price_minor" >= 0)
);

CREATE UNIQUE INDEX "categories_tenant_id_slug_key" ON "categories"("tenant_id", "slug");
CREATE UNIQUE INDEX "categories_tenant_id_id_key" ON "categories"("tenant_id", "id");
CREATE INDEX "categories_tenant_id_status_display_order_idx" ON "categories"("tenant_id", "status", "display_order");
CREATE UNIQUE INDEX "products_tenant_id_slug_key" ON "products"("tenant_id", "slug");
CREATE UNIQUE INDEX "products_tenant_id_id_key" ON "products"("tenant_id", "id");
CREATE INDEX "products_tenant_id_category_id_status_idx" ON "products"("tenant_id", "category_id", "status");
CREATE INDEX "products_tenant_id_availability_status_idx" ON "products"("tenant_id", "availability", "status");

ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_category_id_fkey"
  FOREIGN KEY ("tenant_id", "category_id") REFERENCES "categories"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("key", "description") VALUES
  ('catalog.read', 'Read tenant catalog'),
  ('catalog.manage', 'Manage tenant catalog')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_key")
SELECT "tenant_id", "id", 'catalog.read' FROM "roles"
WHERE "is_system" = TRUE AND "code" IN ('OWNER', 'MANAGER')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_key")
SELECT "tenant_id", "id", 'catalog.manage' FROM "roles"
WHERE "is_system" = TRUE AND "code" IN ('OWNER', 'MANAGER')
ON CONFLICT DO NOTHING;
