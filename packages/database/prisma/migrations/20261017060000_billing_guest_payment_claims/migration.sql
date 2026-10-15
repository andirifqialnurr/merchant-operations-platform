-- Guests at a table say they paid by transfer or QRIS (M4-BE-07). The claim
-- is a payment awaiting the cashier: VERIFYING, with no user and no shift.
-- The cashier confirms it into a PAID payment of their shift, or rejects it
-- (FAILED). Nothing counts as paid before the cashier confirms.
ALTER TABLE "billing_payments" ALTER COLUMN "actor_id" DROP NOT NULL;
-- The visit a guest's claim is for; a reference only, like on bills.
ALTER TABLE "billing_payments" ADD COLUMN "table_session_id" UUID;
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_actor_check"
  CHECK ("actor_id" IS NOT NULL OR "status" IN ('VERIFYING', 'FAILED'));
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_claim_check"
  CHECK (
    "status" <> 'VERIFYING'
    OR (
      "register_session_id" IS NULL
      AND "table_session_id" IS NOT NULL
      AND "method" IN ('TRANSFER', 'MERCHANT_QRIS')
    )
  );
-- A visit waits on at most one claim at a time.
CREATE UNIQUE INDEX "billing_payments_verifying_session_key"
  ON "billing_payments"("tenant_id", "table_session_id") WHERE "status" = 'VERIFYING';

-- How guests at the outlet's tables can pay without the cashier, e.g. the
-- bank account or "scan the QRIS at the counter". No note, no paying from the table.
ALTER TABLE "floor_outlet_policies" ADD COLUMN "guest_payment_note" VARCHAR(500);
