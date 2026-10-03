-- Event delivery (architecture.md 7.1). The worker claims events from the
-- outbox, hands each to its registered handlers, and records per handler in
-- the inbox that the event was dealt with, so an event delivered twice has
-- one effect.

-- Set when an event has used up its attempts. It is kept for a person to look
-- at and is never picked up again on its own.
ALTER TABLE "outbox_events" ADD COLUMN "failed_at" TIMESTAMPTZ(6);
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_outcome_check"
  CHECK ("processed_at" IS NULL OR "failed_at" IS NULL);

-- What the dispatcher scans: only events that still need work.
CREATE INDEX "outbox_events_pending_idx"
  ON "outbox_events"("available_at", "occurred_at")
  WHERE "processed_at" IS NULL AND "failed_at" IS NULL;

CREATE TYPE "InboxEventStatus" AS ENUM ('PROCESSED', 'RETRYING', 'BLOCKED', 'FAILED');

CREATE TABLE "core_inbox_events" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  -- The handler, e.g. "core.entitlement_projection".
  "consumer_name" VARCHAR(120) NOT NULL,
  "event_id" UUID NOT NULL,
  "event_type" VARCHAR(160) NOT NULL,
  "status" "InboxEventStatus" NOT NULL,
  -- What the handler produced, when it wants to be found again.
  "result_reference" VARCHAR(200),
  -- A reason that is safe to show: no payload, no secrets.
  "last_error" VARCHAR(500),
  "attempt_count" INTEGER NOT NULL DEFAULT 1,
  "processed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_inbox_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_inbox_events_attempt_count_check" CHECK ("attempt_count" >= 1),
  CONSTRAINT "core_inbox_events_processed_check"
    CHECK (("status" = 'PROCESSED') = ("processed_at" IS NOT NULL)),
  CONSTRAINT "core_inbox_events_error_check"
    CHECK ("status" = 'PROCESSED' OR "last_error" IS NOT NULL),
  CONSTRAINT "core_inbox_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- One row per handler and event: the second delivery finds the first.
CREATE UNIQUE INDEX "core_inbox_events_tenant_id_consumer_name_event_id_key"
  ON "core_inbox_events"("tenant_id", "consumer_name", "event_id");
CREATE INDEX "core_inbox_events_tenant_id_status_updated_at_idx"
  ON "core_inbox_events"("tenant_id", "status", "updated_at");
CREATE INDEX "core_inbox_events_event_id_idx" ON "core_inbox_events"("event_id");
