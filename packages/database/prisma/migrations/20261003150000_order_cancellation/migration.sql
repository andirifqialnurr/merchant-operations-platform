-- An order that was not paid can be canceled with a reason. The order stays
-- for the audit trail; it is never deleted.

ALTER TABLE "order_orders"
  ADD COLUMN "canceled_at" TIMESTAMPTZ(6),
  ADD COLUMN "canceled_by" UUID,
  ADD COLUMN "cancel_reason" VARCHAR(300);

ALTER TABLE "order_orders" ADD CONSTRAINT "order_orders_cancellation_check" CHECK (
  ("status" = 'CANCELED' AND "canceled_at" IS NOT NULL AND "canceled_by" IS NOT NULL AND "cancel_reason" IS NOT NULL)
  OR ("status" <> 'CANCELED' AND "canceled_at" IS NULL AND "canceled_by" IS NULL AND "cancel_reason" IS NULL)
);

ALTER TABLE "order_orders" ADD CONSTRAINT "order_orders_canceled_by_fkey"
  FOREIGN KEY ("canceled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
