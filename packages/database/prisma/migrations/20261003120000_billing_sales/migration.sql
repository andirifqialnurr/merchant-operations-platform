-- Bills, payments, and sales. Owned by the billing-payment-ledger kernel.
-- Payment status is kept apart from the fulfilment status of the order.

CREATE TYPE "BillStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOID');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MERCHANT_QRIS', 'TRANSFER', 'EDC', 'OTHER');
CREATE TYPE "PaymentStatus" AS ENUM (
  'UNPAID', 'VERIFYING', 'PAID', 'REFUND_PENDING', 'REFUNDED', 'FAILED', 'EXPIRED'
);
CREATE TYPE "SaleStatus" AS ENUM ('OPEN', 'COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED');

CREATE TABLE "billing_bills" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "subtotal_minor" BIGINT NOT NULL,
  "discount_minor" BIGINT NOT NULL DEFAULT 0,
  "tax_minor" BIGINT NOT NULL DEFAULT 0,
  "service_charge_minor" BIGINT NOT NULL DEFAULT 0,
  "rounding_minor" BIGINT NOT NULL DEFAULT 0,
  "total_minor" BIGINT NOT NULL,
  "paid_minor" BIGINT NOT NULL DEFAULT 0,
  "status" "BillStatus" NOT NULL DEFAULT 'UNPAID',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "billing_bills_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_bills_amounts_check" CHECK (
    "subtotal_minor" >= 0
    AND "discount_minor" >= 0
    AND "tax_minor" >= 0
    AND "service_charge_minor" >= 0
    AND "total_minor" >= 0
  ),
  -- The total is always the sum of its parts; it is never entered on its own.
  CONSTRAINT "billing_bills_total_minor_check" CHECK (
    "total_minor" = "subtotal_minor" - "discount_minor" + "tax_minor" + "service_charge_minor" + "rounding_minor"
  ),
  CONSTRAINT "billing_bills_paid_minor_check" CHECK ("paid_minor" >= 0 AND "paid_minor" <= "total_minor"),
  CONSTRAINT "billing_bills_paid_status_check" CHECK (
    "status" <> 'PAID' OR "paid_minor" = "total_minor"
  )
);

CREATE UNIQUE INDEX "billing_bills_tenant_id_id_key" ON "billing_bills"("tenant_id", "id");
-- One bill per order.
CREATE UNIQUE INDEX "billing_bills_tenant_id_order_id_key" ON "billing_bills"("tenant_id", "order_id");
CREATE INDEX "billing_bills_tenant_id_outlet_id_status_created_at_idx"
  ON "billing_bills"("tenant_id", "outlet_id", "status", "created_at");

ALTER TABLE "billing_bills" ADD CONSTRAINT "billing_bills_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_bills" ADD CONSTRAINT "billing_bills_tenant_id_outlet_id_fkey"
  FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_bills" ADD CONSTRAINT "billing_bills_tenant_id_order_id_fkey"
  FOREIGN KEY ("tenant_id", "order_id") REFERENCES "order_orders"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "billing_payments" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "register_session_id" UUID,
  "method" "PaymentMethod" NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  -- Cash handed over by the customer; change is tendered minus amount.
  "tendered_minor" BIGINT,
  "status" "PaymentStatus" NOT NULL,
  "reference" VARCHAR(120),
  "actor_id" UUID NOT NULL,
  "confirmed_by" UUID,
  "confirmed_at" TIMESTAMPTZ(6),
  "idempotency_key" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_payments_amount_minor_check" CHECK ("amount_minor" > 0),
  CONSTRAINT "billing_payments_tendered_minor_check" CHECK (
    ("method" = 'CASH' AND "tendered_minor" IS NOT NULL AND "tendered_minor" >= "amount_minor")
    OR ("method" <> 'CASH' AND "tendered_minor" IS NULL)
  ),
  CONSTRAINT "billing_payments_confirmation_check" CHECK (
    "status" <> 'PAID' OR ("confirmed_by" IS NOT NULL AND "confirmed_at" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "billing_payments_tenant_id_id_key" ON "billing_payments"("tenant_id", "id");
-- Retrying the same request must not take the payment twice.
CREATE UNIQUE INDEX "billing_payments_tenant_id_outlet_id_idempotency_key_key"
  ON "billing_payments"("tenant_id", "outlet_id", "idempotency_key");
CREATE INDEX "billing_payments_tenant_id_register_session_id_method_status_idx"
  ON "billing_payments"("tenant_id", "register_session_id", "method", "status");

ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_tenant_id_outlet_id_fkey"
  FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_tenant_id_register_session_id_fkey"
  FOREIGN KEY ("tenant_id", "register_session_id") REFERENCES "pos_register_sessions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_confirmed_by_fkey"
  FOREIGN KEY ("confirmed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "billing_payment_allocations" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "bill_id" UUID NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_payment_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_payment_allocations_amount_minor_check" CHECK ("amount_minor" > 0)
);

CREATE UNIQUE INDEX "billing_payment_allocations_tenant_id_payment_id_bill_id_key"
  ON "billing_payment_allocations"("tenant_id", "payment_id", "bill_id");
CREATE INDEX "billing_payment_allocations_tenant_id_bill_id_idx"
  ON "billing_payment_allocations"("tenant_id", "bill_id");

ALTER TABLE "billing_payment_allocations" ADD CONSTRAINT "billing_payment_allocations_tenant_id_payment_id_fkey"
  FOREIGN KEY ("tenant_id", "payment_id") REFERENCES "billing_payments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_payment_allocations" ADD CONSTRAINT "billing_payment_allocations_tenant_id_bill_id_fkey"
  FOREIGN KEY ("tenant_id", "bill_id") REFERENCES "billing_bills"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Last sale number handed out per outlet.
CREATE TABLE "sales_number_counters" (
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "sales_number_counters_pkey" PRIMARY KEY ("tenant_id", "outlet_id"),
  CONSTRAINT "sales_number_counters_last_number_check" CHECK ("last_number" >= 0)
);

ALTER TABLE "sales_number_counters" ADD CONSTRAINT "sales_number_counters_tenant_id_outlet_id_fkey"
  FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "sales_sales" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "sale_number" INTEGER NOT NULL,
  "bill_id" UUID NOT NULL,
  "status" "SaleStatus" NOT NULL,
  "total_minor" BIGINT NOT NULL,
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "sales_sales_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_sales_sale_number_check" CHECK ("sale_number" > 0),
  CONSTRAINT "sales_sales_total_minor_check" CHECK ("total_minor" >= 0),
  CONSTRAINT "sales_sales_completed_at_check" CHECK ("status" = 'OPEN' OR "completed_at" IS NOT NULL)
);

CREATE UNIQUE INDEX "sales_sales_tenant_id_id_key" ON "sales_sales"("tenant_id", "id");
CREATE UNIQUE INDEX "sales_sales_tenant_id_outlet_id_sale_number_key"
  ON "sales_sales"("tenant_id", "outlet_id", "sale_number");
-- One sale per bill.
CREATE UNIQUE INDEX "sales_sales_tenant_id_bill_id_key" ON "sales_sales"("tenant_id", "bill_id");
CREATE INDEX "sales_sales_tenant_id_outlet_id_completed_at_idx"
  ON "sales_sales"("tenant_id", "outlet_id", "completed_at");

ALTER TABLE "sales_sales" ADD CONSTRAINT "sales_sales_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_sales" ADD CONSTRAINT "sales_sales_tenant_id_outlet_id_fkey"
  FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_sales" ADD CONSTRAINT "sales_sales_tenant_id_bill_id_fkey"
  FOREIGN KEY ("tenant_id", "bill_id") REFERENCES "billing_bills"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
