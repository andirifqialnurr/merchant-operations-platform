-- Guests who order from a table's QR open the visit themselves (M4-BE-05).
-- They have no account, so a visit may have no opening user.
ALTER TABLE "floor_table_sessions" ALTER COLUMN "opened_by" DROP NOT NULL;
