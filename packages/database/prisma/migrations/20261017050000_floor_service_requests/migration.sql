-- Guests ask for staff from the table's QR (M4-BE-06): a waiter, or the bill.
-- Staff mark a request done. A visit has at most one open request of each
-- kind, so asking again while waiting changes nothing.
CREATE TYPE "FloorServiceRequestType" AS ENUM ('WAITER', 'BILL');
CREATE TYPE "FloorServiceRequestStatus" AS ENUM ('OPEN', 'DONE');

CREATE TABLE "floor_service_requests" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "type" "FloorServiceRequestType" NOT NULL,
  "status" "FloorServiceRequestStatus" NOT NULL DEFAULT 'OPEN',
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "handled_at" TIMESTAMPTZ(6),
  "handled_by" UUID,
  CONSTRAINT "floor_service_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "floor_service_requests_session_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id", "session_id")
    REFERENCES "floor_table_sessions"("tenant_id", "outlet_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_service_requests_handled_by_fkey"
    FOREIGN KEY ("handled_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "floor_service_requests_done_check"
    CHECK (("status" = 'DONE') = ("handled_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "floor_service_requests_open_key"
  ON "floor_service_requests"("tenant_id", "session_id", "type") WHERE "status" = 'OPEN';
CREATE INDEX "floor_service_requests_outlet_open_idx"
  ON "floor_service_requests"("tenant_id", "outlet_id") WHERE "status" = 'OPEN';
