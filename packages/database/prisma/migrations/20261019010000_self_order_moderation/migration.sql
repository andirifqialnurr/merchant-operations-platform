-- Existing orders retain their fulfillment/payment history; only new QR orders wait for staff.
CREATE TYPE "OrderModerationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'ACCEPTED', 'REJECTED');
ALTER TABLE order_orders
  ADD COLUMN moderation_status "OrderModerationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN moderated_at TIMESTAMPTZ(6),
  ADD COLUMN moderated_by UUID REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE order_orders ADD CONSTRAINT order_moderation_decision_check CHECK (
  (moderation_status = 'NOT_REQUIRED' AND moderated_at IS NULL AND moderated_by IS NULL)
  OR (source = 'SELF_ORDER' AND table_session_id IS NOT NULL AND (
    (moderation_status = 'PENDING' AND status = 'SUBMITTED' AND moderated_at IS NULL AND moderated_by IS NULL)
    OR (moderation_status IN ('ACCEPTED', 'REJECTED') AND moderated_at IS NOT NULL AND moderated_by IS NOT NULL
      AND (moderation_status <> 'REJECTED' OR status = 'CANCELED'))
  ))
);
CREATE INDEX order_orders_tenant_id_outlet_id_moderation_status_created_at_idx
  ON order_orders(tenant_id, outlet_id, moderation_status, created_at);
