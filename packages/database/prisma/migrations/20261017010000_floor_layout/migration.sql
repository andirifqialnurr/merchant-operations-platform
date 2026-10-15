-- Floors, areas, and tables of an outlet (M4-BE-01). Positions are logical
-- grid cells, never pixels. Whether a table is free or taken is not stored
-- here: it follows from its sessions (M4-BE-03).
CREATE TYPE "FloorRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "FloorTableShape" AS ENUM ('SQUARE', 'RECTANGLE', 'ROUND');
CREATE TYPE "FloorTableSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

CREATE TABLE "floor_floors" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "grid_cols" INTEGER NOT NULL DEFAULT 24,
  "grid_rows" INTEGER NOT NULL DEFAULT 16,
  "status" "FloorRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "floor_floors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "floor_floors_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_floors_outlet_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_floors_grid_check"
    CHECK ("grid_cols" BETWEEN 8 AND 60 AND "grid_rows" BETWEEN 8 AND 60),
  CONSTRAINT "floor_floors_display_order_check" CHECK ("display_order" >= 0)
);
CREATE UNIQUE INDEX "floor_floors_tenant_id_id_key" ON "floor_floors"("tenant_id", "id");
CREATE UNIQUE INDEX "floor_floors_tenant_outlet_id_key"
  ON "floor_floors"("tenant_id", "outlet_id", "id");
CREATE UNIQUE INDEX "floor_floors_tenant_outlet_name_key"
  ON "floor_floors"("tenant_id", "outlet_id", "name");

CREATE TABLE "floor_areas" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "floor_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "status" "FloorRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "floor_areas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "floor_areas_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  -- An area lies on a floor of the same outlet.
  CONSTRAINT "floor_areas_floor_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id", "floor_id")
    REFERENCES "floor_floors"("tenant_id", "outlet_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_areas_display_order_check" CHECK ("display_order" >= 0)
);
CREATE UNIQUE INDEX "floor_areas_tenant_id_id_key" ON "floor_areas"("tenant_id", "id");
CREATE UNIQUE INDEX "floor_areas_tenant_outlet_id_key"
  ON "floor_areas"("tenant_id", "outlet_id", "id");
CREATE UNIQUE INDEX "floor_areas_tenant_floor_name_key"
  ON "floor_areas"("tenant_id", "floor_id", "name");

CREATE TABLE "floor_service_tables" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "area_id" UUID NOT NULL,
  "label" VARCHAR(20) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "shape" "FloorTableShape" NOT NULL,
  "visual_size" "FloorTableSize" NOT NULL DEFAULT 'MEDIUM',
  -- Both empty while the table waits in the "not placed" tray.
  "grid_x" INTEGER,
  "grid_y" INTEGER,
  "grid_w" INTEGER NOT NULL,
  "grid_h" INTEGER NOT NULL,
  "rotation" SMALLINT NOT NULL DEFAULT 0,
  "qr_ordering" BOOLEAN NOT NULL DEFAULT TRUE,
  "status" "FloorRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "floor_service_tables_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "floor_service_tables_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_service_tables_area_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id", "area_id")
    REFERENCES "floor_areas"("tenant_id", "outlet_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_service_tables_capacity_check" CHECK ("capacity" BETWEEN 1 AND 50),
  CONSTRAINT "floor_service_tables_position_check"
    CHECK (("grid_x" IS NULL) = ("grid_y" IS NULL) AND COALESCE("grid_x", 0) >= 0
      AND COALESCE("grid_y", 0) >= 0),
  CONSTRAINT "floor_service_tables_footprint_check"
    CHECK ("grid_w" BETWEEN 1 AND 12 AND "grid_h" BETWEEN 1 AND 12),
  CONSTRAINT "floor_service_tables_rotation_check" CHECK ("rotation" IN (0, 90))
);
CREATE UNIQUE INDEX "floor_service_tables_tenant_id_id_key"
  ON "floor_service_tables"("tenant_id", "id");
CREATE UNIQUE INDEX "floor_service_tables_tenant_outlet_label_key"
  ON "floor_service_tables"("tenant_id", "outlet_id", "label");
CREATE INDEX "floor_service_tables_tenant_area_idx"
  ON "floor_service_tables"("tenant_id", "area_id");

-- Every outlet starts with a Main Floor holding a Main Area, so tables can be
-- added at once (prd.md 9.2). Outlets are made by the workspace core, which
-- knows nothing of floors; the database adds them.
CREATE FUNCTION "floor_add_default_layout"() RETURNS TRIGGER AS $$
DECLARE
  new_floor_id UUID;
BEGIN
  INSERT INTO "floor_floors" ("tenant_id", "outlet_id", "name")
  VALUES (NEW."tenant_id", NEW."id", 'Main Floor')
  RETURNING "id" INTO new_floor_id;
  INSERT INTO "floor_areas" ("tenant_id", "outlet_id", "floor_id", "name")
  VALUES (NEW."tenant_id", NEW."id", new_floor_id, 'Main Area');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "outlets_add_default_floor"
  AFTER INSERT ON "outlets"
  FOR EACH ROW EXECUTE FUNCTION "floor_add_default_layout"();

-- Outlets that already exist get the same.
WITH added AS (
  INSERT INTO "floor_floors" ("tenant_id", "outlet_id", "name")
  SELECT o."tenant_id", o."id", 'Main Floor' FROM "outlets" o
  RETURNING "id", "tenant_id", "outlet_id"
)
INSERT INTO "floor_areas" ("tenant_id", "outlet_id", "floor_id", "name")
SELECT a."tenant_id", a."outlet_id", a."id", 'Main Area' FROM added a;
