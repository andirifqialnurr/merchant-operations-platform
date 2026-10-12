-- A note on an order line may be 300 characters long. The kitchen's copy must
-- hold all of it, or a ticket for such an order could not be made.
ALTER TABLE "kds_ticket_items"
  ALTER COLUMN "note" TYPE VARCHAR(300),
  ALTER COLUMN "allergy_note" TYPE VARCHAR(300);
