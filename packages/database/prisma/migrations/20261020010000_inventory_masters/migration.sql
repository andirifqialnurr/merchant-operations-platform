-- M5-BE-01B1: master persistence only. No ledger, API grants, module activation,
-- Catalog dependency, limit changes or writes to existing business data.
CREATE TYPE "InventoryRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "inventory_units" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "code" VARCHAR(24) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "precision" SMALLINT NOT NULL,
  -- An irreversible first-reference latch, never a user-entered field.
  "definition_locked" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_units_tenant_id_fkey" FOREIGN KEY ("tenant_id")
    REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_units_code_check" CHECK ("code" ~ '^[A-Za-z][A-Za-z0-9._-]{0,23}$'),
  CONSTRAINT "inventory_units_name_check" CHECK ("name" = btrim("name") AND "name" ~ '[^[:space:]]'),
  CONSTRAINT "inventory_units_precision_check" CHECK ("precision" BETWEEN 0 AND 6)
);
CREATE UNIQUE INDEX "inventory_units_tenant_id_id_key" ON "inventory_units"("tenant_id", "id");
CREATE UNIQUE INDEX "inventory_units_code_ci_key" ON "inventory_units"("tenant_id", lower("code"));

CREATE TABLE "inventory_unit_conversions" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "from_unit_id" UUID NOT NULL,
  "to_unit_id" UUID NOT NULL,
  -- Do NOT add a numeric(p,s) typmod: it rounds BEFORE checks run.
  "factor" NUMERIC NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_unit_conversions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_unit_conversions_tenant_id_fkey" FOREIGN KEY ("tenant_id")
    REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_unit_conversions_from_unit_fkey" FOREIGN KEY ("tenant_id", "from_unit_id")
    REFERENCES "inventory_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_unit_conversions_to_unit_fkey" FOREIGN KEY ("tenant_id", "to_unit_id")
    REFERENCES "inventory_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_unit_conversions_distinct_check" CHECK ("from_unit_id" <> "to_unit_id"),
  CONSTRAINT "inventory_unit_conversions_factor_check" CHECK (
    "factor" > 0 AND "factor" < 1000000000000000000 AND scale("factor") <= 12
  )
);
CREATE UNIQUE INDEX "inventory_unit_conversions_tenant_id_id_key" ON "inventory_unit_conversions"("tenant_id", "id");
CREATE UNIQUE INDEX "inventory_unit_conversions_tenant_id_from_unit_id_to_unit_id_key"
  ON "inventory_unit_conversions"("tenant_id", "from_unit_id", "to_unit_id");
CREATE INDEX "inventory_unit_conversions_tenant_id_to_unit_id_idx" ON "inventory_unit_conversions"("tenant_id", "to_unit_id");

CREATE TABLE "inventory_categories" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "status" "InventoryRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id")
    REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_categories_name_check" CHECK ("name" = btrim("name") AND "name" ~ '[^[:space:]]')
);
CREATE UNIQUE INDEX "inventory_categories_tenant_id_id_key" ON "inventory_categories"("tenant_id", "id");
CREATE UNIQUE INDEX "inventory_categories_name_ci_key" ON "inventory_categories"("tenant_id", lower("name"));
CREATE INDEX "inventory_categories_tenant_id_status_idx" ON "inventory_categories"("tenant_id", "status");

CREATE TABLE "inventory_items" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "sku" VARCHAR(64),
  "name" VARCHAR(160) NOT NULL,
  "category_id" UUID,
  "base_unit_id" UUID NOT NULL,
  "min_stock" NUMERIC,
  "status" "InventoryRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_items_tenant_id_fkey" FOREIGN KEY ("tenant_id")
    REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_category_fkey" FOREIGN KEY ("tenant_id", "category_id")
    REFERENCES "inventory_categories"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_base_unit_fkey" FOREIGN KEY ("tenant_id", "base_unit_id")
    REFERENCES "inventory_units"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_items_name_check" CHECK ("name" = btrim("name") AND "name" ~ '[^[:space:]]'),
  CONSTRAINT "inventory_items_sku_check" CHECK (
    "sku" IS NULL OR ("sku" = btrim("sku") AND "sku" ~ '[^[:space:]]')
  ),
  CONSTRAINT "inventory_items_min_stock_check" CHECK (
    "min_stock" IS NULL OR (
      "min_stock" >= 0 AND "min_stock" < 1000000000000000000000000 AND scale("min_stock") <= 6
    )
  )
);
CREATE UNIQUE INDEX "inventory_items_tenant_id_id_key" ON "inventory_items"("tenant_id", "id");
CREATE UNIQUE INDEX "inventory_items_sku_ci_key" ON "inventory_items"("tenant_id", lower("sku")) WHERE "sku" IS NOT NULL;
CREATE INDEX "inventory_items_tenant_id_status_name_idx" ON "inventory_items"("tenant_id", "status", "name");
CREATE INDEX "inventory_items_tenant_id_category_id_idx" ON "inventory_items"("tenant_id", "category_id");
CREATE INDEX "inventory_items_tenant_id_base_unit_id_idx" ON "inventory_items"("tenant_id", "base_unit_id");

CREATE TABLE "inventory_suppliers" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "contact" VARCHAR(200),
  "status" "InventoryRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_suppliers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_suppliers_tenant_id_fkey" FOREIGN KEY ("tenant_id")
    REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_suppliers_name_check" CHECK ("name" = btrim("name") AND "name" ~ '[^[:space:]]'),
  CONSTRAINT "inventory_suppliers_contact_check" CHECK (
    "contact" IS NULL OR ("contact" = btrim("contact") AND "contact" ~ '[^[:space:]]')
  )
);
CREATE UNIQUE INDEX "inventory_suppliers_tenant_id_id_key" ON "inventory_suppliers"("tenant_id", "id");
CREATE INDEX "inventory_suppliers_tenant_id_status_name_idx" ON "inventory_suppliers"("tenant_id", "status", "name");

CREATE TABLE "inventory_stock_locations" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID,
  "name" VARCHAR(160) NOT NULL,
  "status" "InventoryRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_stock_locations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_stock_locations_tenant_id_fkey" FOREIGN KEY ("tenant_id")
    REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_stock_locations_outlet_fkey" FOREIGN KEY ("tenant_id", "outlet_id")
    REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "inventory_stock_locations_name_check" CHECK ("name" = btrim("name") AND "name" ~ '[^[:space:]]')
);
CREATE UNIQUE INDEX "inventory_stock_locations_tenant_id_id_key" ON "inventory_stock_locations"("tenant_id", "id");
CREATE UNIQUE INDEX "inventory_stock_locations_outlet_name_ci_key"
  ON "inventory_stock_locations"("tenant_id", "outlet_id", lower("name")) WHERE "outlet_id" IS NOT NULL;
CREATE UNIQUE INDEX "inventory_stock_locations_workspace_name_ci_key"
  ON "inventory_stock_locations"("tenant_id", lower("name")) WHERE "outlet_id" IS NULL;
CREATE INDEX "inventory_stock_locations_tenant_id_outlet_id_status_idx"
  ON "inventory_stock_locations"("tenant_id", "outlet_id", "status");

CREATE FUNCTION "inventory_master_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'Inventory master records must be retained'
      USING ERRCODE = '23514', CONSTRAINT = 'inventory_master_retention_check';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Inventory master identity is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'inventory_master_identity_check';
  END IF;
  CASE TG_TABLE_NAME
    WHEN 'inventory_units' THEN
      IF OLD.definition_locked AND (
        NOT NEW.definition_locked OR NEW.code IS DISTINCT FROM OLD.code OR NEW.precision IS DISTINCT FROM OLD.precision
      ) THEN
        RAISE EXCEPTION 'Referenced inventory unit definition is immutable'
          USING ERRCODE = '23514', CONSTRAINT = 'inventory_units_definition_check';
      END IF;
    WHEN 'inventory_items' THEN
      IF NEW.base_unit_id IS DISTINCT FROM OLD.base_unit_id THEN
        RAISE EXCEPTION 'Inventory item base unit is immutable'
          USING ERRCODE = '23514', CONSTRAINT = 'inventory_items_base_unit_check';
      END IF;
    WHEN 'inventory_unit_conversions' THEN
      IF NEW.from_unit_id IS DISTINCT FROM OLD.from_unit_id OR NEW.to_unit_id IS DISTINCT FROM OLD.to_unit_id THEN
        RAISE EXCEPTION 'Inventory conversion endpoints are immutable'
          USING ERRCODE = '23514', CONSTRAINT = 'inventory_unit_conversions_endpoints_check';
      END IF;
    WHEN 'inventory_stock_locations' THEN
      IF NEW.outlet_id IS DISTINCT FROM OLD.outlet_id THEN
        RAISE EXCEPTION 'Inventory storage scope is immutable'
          USING ERRCODE = '23514', CONSTRAINT = 'inventory_stock_locations_scope_check';
      END IF;
    ELSE NULL;
  END CASE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE FUNCTION "inventory_item_unit_guard"() RETURNS trigger AS $$
DECLARE unit_precision SMALLINT;
BEGIN
  -- Hold the definition stable until the AFTER trigger latches a real reference.
  -- A skipped ON CONFLICT insert must not leave a false first-reference latch.
  SELECT precision INTO unit_precision FROM inventory_units
    WHERE tenant_id = NEW.tenant_id AND id = NEW.base_unit_id FOR NO KEY UPDATE;
  -- Missing/cross-tenant units are refused by the composite FK, without guessing.
  IF unit_precision IS NOT NULL AND NEW.min_stock IS NOT NULL
    AND trunc(NEW.min_stock, unit_precision) <> NEW.min_stock THEN
    RAISE EXCEPTION 'Minimum stock exceeds base unit precision'
      USING ERRCODE = '23514', CONSTRAINT = 'inventory_items_min_stock_unit_precision_check';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE FUNCTION "inventory_conversion_units_guard"() RETURNS trigger AS $$
BEGIN
  -- Lock in deterministic UUID order, including explicitly defined reverse pairs.
  PERFORM id FROM inventory_units
    WHERE tenant_id = NEW.tenant_id AND id = ANY(ARRAY[NEW.from_unit_id, NEW.to_unit_id])
    ORDER BY id FOR NO KEY UPDATE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE FUNCTION "inventory_reference_units_latch"() RETURNS trigger AS $$
DECLARE unit_ids UUID[];
BEGIN
  IF TG_TABLE_NAME = 'inventory_items' THEN
    unit_ids := ARRAY[NEW.base_unit_id];
  ELSE
    unit_ids := ARRAY[NEW.from_unit_id, NEW.to_unit_id];
  END IF;
  -- BEFORE triggers already hold the parent locks. This actual row write also
  -- fences stale repeatable-read definition writers, unlike snapshot EXISTS.
  -- AFTER runs only for persisted rows, not skipped/upsert candidate inputs.
  -- updated_at is unchanged: this is an internal latch, not a definition edit.
  UPDATE inventory_units SET definition_locked = TRUE
    WHERE tenant_id = NEW.tenant_id AND id = ANY(unit_ids) AND NOT definition_locked;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TRIGGER "inventory_units_guard" BEFORE UPDATE OR DELETE ON "inventory_units" FOR EACH ROW EXECUTE FUNCTION "inventory_master_guard"();
CREATE TRIGGER "inventory_units_truncate_guard" BEFORE TRUNCATE ON "inventory_units" FOR EACH STATEMENT EXECUTE FUNCTION "inventory_master_guard"();
CREATE TRIGGER "inventory_unit_conversions_guard" BEFORE UPDATE OR DELETE ON "inventory_unit_conversions" FOR EACH ROW EXECUTE FUNCTION "inventory_master_guard"();
CREATE TRIGGER "inventory_unit_conversions_truncate_guard" BEFORE TRUNCATE ON "inventory_unit_conversions" FOR EACH STATEMENT EXECUTE FUNCTION "inventory_master_guard"();
CREATE TRIGGER "inventory_categories_guard" BEFORE UPDATE OR DELETE ON "inventory_categories" FOR EACH ROW EXECUTE FUNCTION "inventory_master_guard"();
CREATE TRIGGER "inventory_categories_truncate_guard" BEFORE TRUNCATE ON "inventory_categories" FOR EACH STATEMENT EXECUTE FUNCTION "inventory_master_guard"();
CREATE TRIGGER "inventory_items_guard" BEFORE UPDATE OR DELETE ON "inventory_items" FOR EACH ROW EXECUTE FUNCTION "inventory_master_guard"();
CREATE TRIGGER "inventory_items_truncate_guard" BEFORE TRUNCATE ON "inventory_items" FOR EACH STATEMENT EXECUTE FUNCTION "inventory_master_guard"();
CREATE TRIGGER "inventory_suppliers_guard" BEFORE UPDATE OR DELETE ON "inventory_suppliers" FOR EACH ROW EXECUTE FUNCTION "inventory_master_guard"();
CREATE TRIGGER "inventory_suppliers_truncate_guard" BEFORE TRUNCATE ON "inventory_suppliers" FOR EACH STATEMENT EXECUTE FUNCTION "inventory_master_guard"();
CREATE TRIGGER "inventory_stock_locations_guard" BEFORE UPDATE OR DELETE ON "inventory_stock_locations" FOR EACH ROW EXECUTE FUNCTION "inventory_master_guard"();
CREATE TRIGGER "inventory_stock_locations_truncate_guard" BEFORE TRUNCATE ON "inventory_stock_locations" FOR EACH STATEMENT EXECUTE FUNCTION "inventory_master_guard"();
CREATE TRIGGER "inventory_items_unit_guard" BEFORE INSERT OR UPDATE ON "inventory_items" FOR EACH ROW EXECUTE FUNCTION "inventory_item_unit_guard"();
CREATE TRIGGER "inventory_unit_conversions_units_guard" BEFORE INSERT OR UPDATE ON "inventory_unit_conversions" FOR EACH ROW EXECUTE FUNCTION "inventory_conversion_units_guard"();
CREATE TRIGGER "inventory_items_units_latch" AFTER INSERT OR UPDATE ON "inventory_items" FOR EACH ROW EXECUTE FUNCTION "inventory_reference_units_latch"();
CREATE TRIGGER "inventory_unit_conversions_units_latch" AFTER INSERT OR UPDATE ON "inventory_unit_conversions" FOR EACH ROW EXECUTE FUNCTION "inventory_reference_units_latch"();
