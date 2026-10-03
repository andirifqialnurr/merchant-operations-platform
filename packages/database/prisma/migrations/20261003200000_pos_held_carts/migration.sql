-- Carts a cashier set aside to finish later. A held cart is not an order:
-- it has no number, no price snapshot, and no effect on cash. Resuming it
-- removes it, so only one cashier can pick it up.

CREATE TABLE "pos_held_carts" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "label" VARCHAR(60) NOT NULL,
  "lines" JSONB NOT NULL,
  "item_count" INTEGER NOT NULL,
  "created_by" UUID NOT NULL,
  "idempotency_key" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_held_carts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_held_carts_label_check" CHECK (length(btrim("label")) > 0),
  CONSTRAINT "pos_held_carts_item_count_check" CHECK ("item_count" > 0)
);

CREATE UNIQUE INDEX "pos_held_carts_tenant_id_id_key" ON "pos_held_carts"("tenant_id", "id");
CREATE UNIQUE INDEX "pos_held_carts_tenant_id_outlet_id_idempotency_key_key"
  ON "pos_held_carts"("tenant_id", "outlet_id", "idempotency_key");
CREATE INDEX "pos_held_carts_tenant_id_outlet_id_created_at_idx"
  ON "pos_held_carts"("tenant_id", "outlet_id", "created_at");

ALTER TABLE "pos_held_carts" ADD CONSTRAINT "pos_held_carts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_held_carts" ADD CONSTRAINT "pos_held_carts_tenant_id_outlet_id_fkey"
  FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_held_carts" ADD CONSTRAINT "pos_held_carts_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
