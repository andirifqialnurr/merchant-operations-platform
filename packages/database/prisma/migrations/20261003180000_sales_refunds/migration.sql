-- Refunds of completed sales. The sale and its payment stay as they were;
-- a refund is a new record, and cash refunds come out of the shift they are
-- paid in.

CREATE TYPE "RefundStatus" AS ENUM ('COMPLETED');

CREATE TABLE "sales_refunds" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "sale_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "register_session_id" UUID NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "reason" VARCHAR(300) NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'COMPLETED',
  "actor_id" UUID NOT NULL,
  "approved_by" UUID,
  "idempotency_key" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_refunds_amount_minor_check" CHECK ("amount_minor" > 0),
  CONSTRAINT "sales_refunds_reason_check" CHECK (length(btrim("reason")) >= 3)
);

CREATE UNIQUE INDEX "sales_refunds_tenant_id_id_key" ON "sales_refunds"("tenant_id", "id");
-- Retrying the same request must not refund twice.
CREATE UNIQUE INDEX "sales_refunds_tenant_id_outlet_id_idempotency_key_key"
  ON "sales_refunds"("tenant_id", "outlet_id", "idempotency_key");
CREATE INDEX "sales_refunds_tenant_id_sale_id_idx" ON "sales_refunds"("tenant_id", "sale_id");
CREATE INDEX "sales_refunds_tenant_id_register_session_id_method_idx"
  ON "sales_refunds"("tenant_id", "register_session_id", "method");

ALTER TABLE "sales_refunds" ADD CONSTRAINT "sales_refunds_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_refunds" ADD CONSTRAINT "sales_refunds_tenant_id_outlet_id_fkey"
  FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_refunds" ADD CONSTRAINT "sales_refunds_tenant_id_sale_id_fkey"
  FOREIGN KEY ("tenant_id", "sale_id") REFERENCES "sales_sales"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_refunds" ADD CONSTRAINT "sales_refunds_tenant_id_payment_id_fkey"
  FOREIGN KEY ("tenant_id", "payment_id") REFERENCES "billing_payments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_refunds" ADD CONSTRAINT "sales_refunds_tenant_id_register_session_id_fkey"
  FOREIGN KEY ("tenant_id", "register_session_id") REFERENCES "pos_register_sessions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_refunds" ADD CONSTRAINT "sales_refunds_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_refunds" ADD CONSTRAINT "sales_refunds_approved_by_fkey"
  FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
