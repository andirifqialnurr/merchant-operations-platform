-- Metering (Packages & Limits section 16, prd.md 7.1): what a workspace uses,
-- per dimension, so limits can be shown and enforced.

CREATE TYPE "UsageEnforcement" AS ENUM ('HARD_COUNT', 'SOFT_METERED', 'THROTTLED');

-- The catalog of what can be limited. Platform data, the same for every tenant.
CREATE TABLE "core_usage_dimensions" (
  "key" VARCHAR(120) NOT NULL,
  "unit" VARCHAR(20) NOT NULL,
  "enforcement" "UsageEnforcement" NOT NULL,
  CONSTRAINT "core_usage_dimensions_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "core_usage_dimensions_key_check"
    CHECK ("key" ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$')
);

INSERT INTO "core_usage_dimensions" ("key", "unit", "enforcement") VALUES
  ('core.business_units.active', 'count', 'HARD_COUNT'),
  ('core.locations.active', 'count', 'HARD_COUNT'),
  ('core.users.active', 'seat', 'HARD_COUNT'),
  ('core.roles.custom', 'count', 'HARD_COUNT'),
  ('core.storage.gb', 'GB', 'HARD_COUNT'),
  ('catalog.products.active', 'count', 'HARD_COUNT'),
  ('pos.registers.active', 'device', 'HARD_COUNT'),
  ('pos.sales.completed.cycle', 'event', 'SOFT_METERED'),
  ('floor.tables.active_per_location', 'count', 'HARD_COUNT'),
  ('floor.floors.active_per_location', 'count', 'HARD_COUNT'),
  ('floor.areas.active_per_floor', 'count', 'HARD_COUNT'),
  ('self_order.orders.submitted.cycle', 'event', 'SOFT_METERED'),
  ('kds.devices.active', 'device', 'HARD_COUNT'),
  ('kds.stations.active_per_location', 'count', 'HARD_COUNT'),
  ('kds.tickets.created.cycle', 'event', 'SOFT_METERED'),
  ('inventory.items.active', 'count', 'HARD_COUNT'),
  ('inventory.stock_locations.active', 'count', 'HARD_COUNT'),
  ('inventory.movements.posted.cycle', 'event', 'SOFT_METERED'),
  ('finance.accounts.active', 'count', 'HARD_COUNT'),
  ('finance.transactions.posted.cycle', 'event', 'SOFT_METERED'),
  ('hc.employees.active', 'seat', 'HARD_COUNT'),
  ('hc.attendance.received.cycle', 'event', 'SOFT_METERED'),
  ('customer.profiles.active', 'count', 'HARD_COUNT'),
  ('reports.exports.cycle', 'job', 'THROTTLED'),
  ('api.requests.cycle', 'request', 'THROTTLED');

-- One row per thing that was used. The same idempotency key never counts twice.
CREATE TABLE "core_usage_events" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "dimension_key" VARCHAR(120) NOT NULL,
  "quantity" BIGINT NOT NULL,
  "source_type" VARCHAR(120) NOT NULL,
  "source_reference" VARCHAR(160),
  "idempotency_key" VARCHAR(255) NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_usage_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_usage_events_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "core_usage_events_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "core_usage_events_dimension_key_fkey"
    FOREIGN KEY ("dimension_key") REFERENCES "core_usage_dimensions"("key")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "core_usage_events_tenant_id_dimension_key_idempotency_key_key"
  ON "core_usage_events"("tenant_id", "dimension_key", "idempotency_key");
CREATE INDEX "core_usage_events_tenant_id_dimension_key_occurred_at_idx"
  ON "core_usage_events"("tenant_id", "dimension_key", "occurred_at");

-- A correction by a person, with a reason. It applies to one period.
CREATE TABLE "core_usage_adjustments" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "dimension_key" VARCHAR(120) NOT NULL,
  "period_start" TIMESTAMPTZ(6) NOT NULL,
  "delta" BIGINT NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "actor_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_usage_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_usage_adjustments_delta_check" CHECK ("delta" <> 0),
  CONSTRAINT "core_usage_adjustments_reason_check" CHECK (char_length(btrim("reason")) >= 3),
  CONSTRAINT "core_usage_adjustments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "core_usage_adjustments_dimension_key_fkey"
    FOREIGN KEY ("dimension_key") REFERENCES "core_usage_dimensions"("key")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "core_usage_adjustments_tenant_id_dimension_key_period_start_idx"
  ON "core_usage_adjustments"("tenant_id", "dimension_key", "period_start");

-- The running total of a period: events plus adjustments. It can be rebuilt
-- from those two tables at any time.
CREATE TABLE "core_usage_counters" (
  "tenant_id" UUID NOT NULL,
  "dimension_key" VARCHAR(120) NOT NULL,
  "period_start" TIMESTAMPTZ(6) NOT NULL,
  "period_end" TIMESTAMPTZ(6) NOT NULL,
  "quantity" BIGINT NOT NULL DEFAULT 0,
  "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_usage_counters_pkey" PRIMARY KEY ("tenant_id", "dimension_key", "period_start"),
  CONSTRAINT "core_usage_counters_quantity_check" CHECK ("quantity" >= 0),
  CONSTRAINT "core_usage_counters_period_check" CHECK ("period_end" > "period_start"),
  CONSTRAINT "core_usage_counters_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "core_usage_counters_dimension_key_fkey"
    FOREIGN KEY ("dimension_key") REFERENCES "core_usage_dimensions"("key")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- A threshold is announced once per period, however often it is crossed.
CREATE TABLE "core_limit_notifications" (
  "tenant_id" UUID NOT NULL,
  "dimension_key" VARCHAR(120) NOT NULL,
  "period_start" TIMESTAMPTZ(6) NOT NULL,
  "threshold" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_limit_notifications_pkey"
    PRIMARY KEY ("tenant_id", "dimension_key", "period_start", "threshold"),
  CONSTRAINT "core_limit_notifications_threshold_check" CHECK ("threshold" IN (80, 100)),
  CONSTRAINT "core_limit_notifications_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "core_limit_notifications_dimension_key_fkey"
    FOREIGN KEY ("dimension_key") REFERENCES "core_usage_dimensions"("key")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
