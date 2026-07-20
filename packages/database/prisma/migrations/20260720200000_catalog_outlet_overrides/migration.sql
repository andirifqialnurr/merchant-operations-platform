CREATE TABLE "outlet_products" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "price_override_minor" BIGINT,
  "availability_override" "ProductAvailability",
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "status" "CatalogRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "outlet_products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "outlet_products_price_override_minor_check" CHECK (
    "price_override_minor" IS NULL OR "price_override_minor" >= 0
  ),
  CONSTRAINT "outlet_products_display_order_check" CHECK (
    "display_order" BETWEEN 0 AND 100000
  )
);

CREATE UNIQUE INDEX "outlet_products_tenant_id_id_key"
  ON "outlet_products"("tenant_id", "id");
CREATE UNIQUE INDEX "outlet_products_tenant_id_outlet_id_product_id_key"
  ON "outlet_products"("tenant_id", "outlet_id", "product_id");
CREATE INDEX "outlet_products_tenant_id_outlet_id_status_display_order_idx"
  ON "outlet_products"("tenant_id", "outlet_id", "status", "display_order");
CREATE INDEX "outlet_products_tenant_id_product_id_status_idx"
  ON "outlet_products"("tenant_id", "product_id", "status");

ALTER TABLE "outlet_products" ADD CONSTRAINT "outlet_products_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_products" ADD CONSTRAINT "outlet_products_tenant_id_outlet_id_fkey"
  FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outlet_products" ADD CONSTRAINT "outlet_products_tenant_id_product_id_fkey"
  FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
