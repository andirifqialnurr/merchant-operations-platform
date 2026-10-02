-- Orders taken at an outlet. Owned by the order-intake kernel; POS, self-order,
-- and other sources create orders through it and react through outbox events.

CREATE TYPE "OrderSource" AS ENUM ('POS', 'SELF_ORDER', 'MANUAL', 'EXTERNAL');
CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKEAWAY');
CREATE TYPE "OrderStatus" AS ENUM (
  'DRAFT', 'SUBMITTED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELED'
);

-- Last order number handed out per outlet. Incremented in the same transaction
-- that creates the order, so numbers never repeat within an outlet.
CREATE TABLE "order_number_counters" (
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "order_number_counters_pkey" PRIMARY KEY ("tenant_id", "outlet_id"),
  CONSTRAINT "order_number_counters_last_number_check" CHECK ("last_number" >= 0)
);

ALTER TABLE "order_number_counters" ADD CONSTRAINT "order_number_counters_tenant_id_outlet_id_fkey"
  FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "order_orders" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "order_number" INTEGER NOT NULL,
  "source" "OrderSource" NOT NULL,
  "order_type" "OrderType" NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" CHAR(3) NOT NULL,
  "note" VARCHAR(500),
  "submitted_at" TIMESTAMPTZ(6),
  "actor_id" UUID,
  "idempotency_key" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "order_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_orders_order_number_check" CHECK ("order_number" > 0),
  CONSTRAINT "order_orders_submitted_at_check" CHECK ("status" = 'DRAFT' OR "submitted_at" IS NOT NULL)
);

CREATE UNIQUE INDEX "order_orders_tenant_id_id_key" ON "order_orders"("tenant_id", "id");
CREATE UNIQUE INDEX "order_orders_tenant_id_outlet_id_order_number_key"
  ON "order_orders"("tenant_id", "outlet_id", "order_number");
-- Retrying the same request must not create a second order.
CREATE UNIQUE INDEX "order_orders_tenant_id_outlet_id_idempotency_key_key"
  ON "order_orders"("tenant_id", "outlet_id", "idempotency_key");
CREATE INDEX "order_orders_tenant_id_outlet_id_status_created_at_idx"
  ON "order_orders"("tenant_id", "outlet_id", "status", "created_at");

ALTER TABLE "order_orders" ADD CONSTRAINT "order_orders_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_orders" ADD CONSTRAINT "order_orders_tenant_id_outlet_id_fkey"
  FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_orders" ADD CONSTRAINT "order_orders_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Order lines are snapshots: later catalog changes never alter a taken order.
CREATE TABLE "order_order_items" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "product_id" UUID,
  "name_snapshot" VARCHAR(160) NOT NULL,
  "variant_name_snapshot" VARCHAR(160),
  "unit_price_minor" BIGINT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "line_total_minor" BIGINT NOT NULL,
  "note" VARCHAR(300),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_order_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_order_items_unit_price_minor_check" CHECK ("unit_price_minor" >= 0),
  CONSTRAINT "order_order_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "order_order_items_line_total_minor_check" CHECK ("line_total_minor" = "unit_price_minor" * "quantity")
);

CREATE UNIQUE INDEX "order_order_items_tenant_id_id_key" ON "order_order_items"("tenant_id", "id");
CREATE UNIQUE INDEX "order_order_items_tenant_id_order_id_position_key"
  ON "order_order_items"("tenant_id", "order_id", "position");

ALTER TABLE "order_order_items" ADD CONSTRAINT "order_order_items_tenant_id_order_id_fkey"
  FOREIGN KEY ("tenant_id", "order_id") REFERENCES "order_orders"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_order_items" ADD CONSTRAINT "order_order_items_tenant_id_product_id_fkey"
  FOREIGN KEY ("tenant_id", "product_id") REFERENCES "products"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "order_item_modifiers" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "order_item_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "group_name_snapshot" VARCHAR(160) NOT NULL,
  "option_name_snapshot" VARCHAR(160) NOT NULL,
  "price_delta_minor" BIGINT NOT NULL,
  CONSTRAINT "order_item_modifiers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_item_modifiers_price_delta_minor_check" CHECK ("price_delta_minor" >= 0)
);

CREATE UNIQUE INDEX "order_item_modifiers_tenant_id_order_item_id_position_key"
  ON "order_item_modifiers"("tenant_id", "order_item_id", "position");

ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_tenant_id_order_item_id_fkey"
  FOREIGN KEY ("tenant_id", "order_item_id") REFERENCES "order_order_items"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
