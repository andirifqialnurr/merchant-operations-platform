CREATE TYPE "ModifierSelectionType" AS ENUM ('SINGLE', 'MULTIPLE');

CREATE TABLE "product_variants" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "price_delta_minor" BIGINT NOT NULL DEFAULT 0,
  "availability" "ProductAvailability" NOT NULL DEFAULT 'AVAILABLE',
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "status" "CatalogRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_variants_price_delta_minor_check" CHECK ("price_delta_minor" >= 0),
  CONSTRAINT "product_variants_display_order_check" CHECK ("display_order" BETWEEN 0 AND 100000)
);

CREATE TABLE "modifier_groups" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "selection_type" "ModifierSelectionType" NOT NULL DEFAULT 'SINGLE',
  "min_selections" INTEGER NOT NULL DEFAULT 0,
  "max_selections" INTEGER NOT NULL DEFAULT 1,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "status" "CatalogRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "modifier_groups_selection_range_check" CHECK (
    "min_selections" BETWEEN 0 AND 100
    AND "max_selections" BETWEEN 0 AND 100
    AND "min_selections" <= "max_selections"
  ),
  CONSTRAINT "modifier_groups_single_selection_check" CHECK (
    "selection_type" = 'MULTIPLE' OR "max_selections" <= 1
  ),
  CONSTRAINT "modifier_groups_display_order_check" CHECK ("display_order" BETWEEN 0 AND 100000)
);

CREATE TABLE "modifier_options" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "price_delta_minor" BIGINT NOT NULL DEFAULT 0,
  "availability" "ProductAvailability" NOT NULL DEFAULT 'AVAILABLE',
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "status" "CatalogRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "modifier_options_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "modifier_options_price_delta_minor_check" CHECK ("price_delta_minor" >= 0),
  CONSTRAINT "modifier_options_display_order_check" CHECK ("display_order" BETWEEN 0 AND 100000)
);

CREATE TABLE "product_modifier_groups" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "modifier_group_id" UUID NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "status" "CatalogRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "product_modifier_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_modifier_groups_display_order_check" CHECK ("display_order" BETWEEN 0 AND 100000)
);

CREATE TABLE "product_images" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "product_id" UUID NOT NULL,
  "object_key" VARCHAR(512) NOT NULL,
  "content_type" VARCHAR(100) NOT NULL,
  "alt_text" VARCHAR(300),
  "width" INTEGER,
  "height" INTEGER,
  "is_primary" BOOLEAN NOT NULL DEFAULT FALSE,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "status" "CatalogRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "product_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_images_content_type_check" CHECK (
    "content_type" IN ('image/avif', 'image/jpeg', 'image/png', 'image/webp')
  ),
  CONSTRAINT "product_images_dimensions_check" CHECK (
    ("width" IS NULL OR "width" BETWEEN 1 AND 100000)
    AND ("height" IS NULL OR "height" BETWEEN 1 AND 100000)
  ),
  CONSTRAINT "product_images_display_order_check" CHECK ("display_order" BETWEEN 0 AND 100000)
);

CREATE UNIQUE INDEX "product_variants_tenant_id_id_key" ON "product_variants"("tenant_id", "id");
CREATE UNIQUE INDEX "product_variants_tenant_id_product_id_name_key" ON "product_variants"("tenant_id", "product_id", "name");
CREATE INDEX "product_variants_tenant_id_product_id_status_display_order_idx" ON "product_variants"("tenant_id", "product_id", "status", "display_order");
CREATE UNIQUE INDEX "modifier_groups_tenant_id_id_key" ON "modifier_groups"("tenant_id", "id");
CREATE UNIQUE INDEX "modifier_groups_tenant_id_name_key" ON "modifier_groups"("tenant_id", "name");
CREATE INDEX "modifier_groups_tenant_id_status_display_order_idx" ON "modifier_groups"("tenant_id", "status", "display_order");
CREATE UNIQUE INDEX "modifier_options_tenant_id_id_key" ON "modifier_options"("tenant_id", "id");
CREATE UNIQUE INDEX "modifier_options_tenant_id_group_id_name_key" ON "modifier_options"("tenant_id", "group_id", "name");
CREATE INDEX "modifier_options_tenant_id_group_id_status_display_order_idx" ON "modifier_options"("tenant_id", "group_id", "status", "display_order");
CREATE UNIQUE INDEX "product_modifier_groups_tenant_id_id_key" ON "product_modifier_groups"("tenant_id", "id");
CREATE UNIQUE INDEX "product_modifier_groups_tenant_id_product_id_modifier_group_id_key" ON "product_modifier_groups"("tenant_id", "product_id", "modifier_group_id");
CREATE INDEX "product_modifier_groups_tenant_id_product_id_status_display_order_idx" ON "product_modifier_groups"("tenant_id", "product_id", "status", "display_order");
CREATE INDEX "product_modifier_groups_tenant_id_modifier_group_id_status_idx" ON "product_modifier_groups"("tenant_id", "modifier_group_id", "status");
CREATE UNIQUE INDEX "product_images_tenant_id_id_key" ON "product_images"("tenant_id", "id");
CREATE UNIQUE INDEX "product_images_tenant_id_object_key_key" ON "product_images"("tenant_id", "object_key");
CREATE UNIQUE INDEX "product_images_active_primary_product_key" ON "product_images"("tenant_id", "product_id") WHERE "is_primary" = TRUE AND "status" = 'ACTIVE';
CREATE INDEX "product_images_tenant_id_product_id_status_display_order_idx" ON "product_images"("tenant_id", "product_id", "status", "display_order");

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_tenant_id_product_id_fkey"
  FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_tenant_id_group_id_fkey"
  FOREIGN KEY ("tenant_id", "group_id") REFERENCES "modifier_groups"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_tenant_id_product_id_fkey"
  FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_tenant_id_modifier_group_id_fkey"
  FOREIGN KEY ("tenant_id", "modifier_group_id") REFERENCES "modifier_groups"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_tenant_id_product_id_fkey"
  FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
