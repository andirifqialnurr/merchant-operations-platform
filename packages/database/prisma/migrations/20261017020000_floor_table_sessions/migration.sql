-- Guests at tables (M4-BE-02). A session is one party's visit; it stands at
-- one or more tables through floor_session_tables, and its orders and bills
-- carry its id. Whether a table is free follows from these rows (M4-BE-03).
CREATE TYPE "FloorTableSessionStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED');
CREATE TYPE "FloorSessionTableRole" AS ENUM ('PRIMARY', 'MERGED');

-- floor_session_tables names a table together with its outlet.
CREATE UNIQUE INDEX "floor_service_tables_tenant_outlet_id_key"
  ON "floor_service_tables"("tenant_id", "outlet_id", "id");

CREATE TABLE "floor_table_sessions" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  -- What staff call the visit; counts up per outlet.
  "display_number" INTEGER NOT NULL,
  "guest_count" INTEGER NOT NULL,
  "status" "FloorTableSessionStatus" NOT NULL DEFAULT 'OPEN',
  "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "opened_by" UUID NOT NULL,
  "closing_at" TIMESTAMPTZ(6),
  "closed_at" TIMESTAMPTZ(6),
  "closed_by" UUID,
  -- Set when the closed table must be cleaned before the next guests.
  "needs_cleaning" BOOLEAN NOT NULL DEFAULT FALSE,
  "cleaned_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "floor_table_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "floor_table_sessions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_table_sessions_outlet_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_table_sessions_opened_by_fkey"
    FOREIGN KEY ("opened_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_table_sessions_closed_by_fkey"
    FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_table_sessions_guest_count_check" CHECK ("guest_count" BETWEEN 1 AND 99),
  CONSTRAINT "floor_table_sessions_display_number_check" CHECK ("display_number" >= 1),
  CONSTRAINT "floor_table_sessions_closed_check"
    CHECK (("status" = 'CLOSED') = ("closed_at" IS NOT NULL)),
  CONSTRAINT "floor_table_sessions_closing_check"
    CHECK ("status" = 'OPEN' OR "closing_at" IS NOT NULL OR "status" = 'CLOSED'),
  CONSTRAINT "floor_table_sessions_cleaned_check"
    CHECK ("cleaned_at" IS NULL OR ("closed_at" IS NOT NULL AND "needs_cleaning"))
);
CREATE UNIQUE INDEX "floor_table_sessions_tenant_id_id_key"
  ON "floor_table_sessions"("tenant_id", "id");
CREATE UNIQUE INDEX "floor_table_sessions_tenant_outlet_id_key"
  ON "floor_table_sessions"("tenant_id", "outlet_id", "id");
CREATE UNIQUE INDEX "floor_table_sessions_number_key"
  ON "floor_table_sessions"("tenant_id", "outlet_id", "display_number");
CREATE INDEX "floor_table_sessions_open_idx"
  ON "floor_table_sessions"("tenant_id", "outlet_id", "status");

CREATE TABLE "floor_session_tables" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "table_id" UUID NOT NULL,
  "role" "FloorSessionTableRole" NOT NULL DEFAULT 'PRIMARY',
  "attached_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Empty while the session holds the table: open, closing, or awaiting cleaning.
  "detached_at" TIMESTAMPTZ(6),
  CONSTRAINT "floor_session_tables_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "floor_session_tables_session_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id", "session_id")
    REFERENCES "floor_table_sessions"("tenant_id", "outlet_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_session_tables_table_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id", "table_id")
    REFERENCES "floor_service_tables"("tenant_id", "outlet_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_session_tables_detached_check"
    CHECK ("detached_at" IS NULL OR "detached_at" >= "attached_at")
);
-- A table holds at most one session at a time.
CREATE UNIQUE INDEX "floor_session_tables_active_table_key"
  ON "floor_session_tables"("tenant_id", "table_id") WHERE "detached_at" IS NULL;
-- A session has at most one primary table at a time.
CREATE UNIQUE INDEX "floor_session_tables_active_primary_key"
  ON "floor_session_tables"("tenant_id", "session_id")
  WHERE "detached_at" IS NULL AND "role" = 'PRIMARY';
CREATE INDEX "floor_session_tables_session_idx"
  ON "floor_session_tables"("tenant_id", "session_id");

-- How an outlet turns tables around.
CREATE TABLE "floor_outlet_policies" (
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  -- A closed table is "cleaning" until someone marks it free.
  "cleaning_after_close" BOOLEAN NOT NULL DEFAULT FALSE,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "floor_outlet_policies_pkey" PRIMARY KEY ("tenant_id", "outlet_id"),
  CONSTRAINT "floor_outlet_policies_outlet_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Orders and bills name the session they belong to. The kernels hold the id
-- as a reference only, so they keep working without the tables module.
ALTER TABLE "order_orders" ADD COLUMN "table_session_id" UUID;
ALTER TABLE "order_orders" ADD CONSTRAINT "order_orders_table_session_check"
  CHECK ("table_session_id" IS NULL OR "order_type" = 'DINE_IN');
CREATE INDEX "order_orders_table_session_idx"
  ON "order_orders"("tenant_id", "table_session_id") WHERE "table_session_id" IS NOT NULL;

ALTER TABLE "billing_bills" ADD COLUMN "table_session_id" UUID;
CREATE INDEX "billing_bills_table_session_idx"
  ON "billing_bills"("tenant_id", "table_session_id") WHERE "table_session_id" IS NOT NULL;

-- Seating guests is the cashier's and the waiter's work too.
INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_key")
SELECT r."tenant_id", r."id", 'table.manage'
FROM "roles" r
WHERE r."is_system" = TRUE AND r."code" IN ('CASHIER', 'WAITER')
ON CONFLICT DO NOTHING;
