-- POS shift (register session) and cash movements.
-- Owned by the POS & Sales module; other modules react through outbox events.

CREATE TYPE "RegisterSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "CashMovementDirection" AS ENUM ('IN', 'OUT');

CREATE TABLE "pos_register_sessions" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "status" "RegisterSessionStatus" NOT NULL DEFAULT 'OPEN',
  "opened_by" UUID NOT NULL,
  "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "opening_cash_minor" BIGINT NOT NULL,
  "closed_by" UUID,
  "closed_at" TIMESTAMPTZ(6),
  "expected_cash_minor" BIGINT,
  "counted_cash_minor" BIGINT,
  "variance_minor" BIGINT,
  "variance_reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "pos_register_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_register_sessions_opening_cash_minor_check" CHECK ("opening_cash_minor" >= 0),
  CONSTRAINT "pos_register_sessions_counted_cash_minor_check" CHECK (
    "counted_cash_minor" IS NULL OR "counted_cash_minor" >= 0
  ),
  -- An open session carries no closing facts; a closed one carries all of them.
  CONSTRAINT "pos_register_sessions_closing_facts_check" CHECK (
    (
      "status" = 'OPEN'
      AND "closed_by" IS NULL
      AND "closed_at" IS NULL
      AND "expected_cash_minor" IS NULL
      AND "counted_cash_minor" IS NULL
      AND "variance_minor" IS NULL
      AND "variance_reason" IS NULL
    )
    OR (
      "status" = 'CLOSED'
      AND "closed_by" IS NOT NULL
      AND "closed_at" IS NOT NULL
      AND "expected_cash_minor" IS NOT NULL
      AND "counted_cash_minor" IS NOT NULL
      AND "variance_minor" IS NOT NULL
    )
  ),
  -- Variance is derived, never entered, and a non-zero variance needs a reason.
  CONSTRAINT "pos_register_sessions_variance_check" CHECK (
    "status" = 'OPEN'
    OR (
      "variance_minor" = "counted_cash_minor" - "expected_cash_minor"
      AND ("variance_minor" = 0 OR "variance_reason" IS NOT NULL)
    )
  )
);

CREATE UNIQUE INDEX "pos_register_sessions_tenant_id_id_key"
  ON "pos_register_sessions"("tenant_id", "id");
-- One open shift per cashier per outlet.
CREATE UNIQUE INDEX "pos_register_sessions_one_open_per_cashier_key"
  ON "pos_register_sessions"("tenant_id", "outlet_id", "opened_by")
  WHERE "status" = 'OPEN';
CREATE INDEX "pos_register_sessions_tenant_id_outlet_id_status_opened_at_idx"
  ON "pos_register_sessions"("tenant_id", "outlet_id", "status", "opened_at");

ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_tenant_id_outlet_id_fkey"
  FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_opened_by_fkey"
  FOREIGN KEY ("opened_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_register_sessions" ADD CONSTRAINT "pos_register_sessions_closed_by_fkey"
  FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "pos_cash_movements" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "register_session_id" UUID NOT NULL,
  "direction" "CashMovementDirection" NOT NULL,
  "amount_minor" BIGINT NOT NULL,
  "reason" VARCHAR(300) NOT NULL,
  "actor_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_cash_movements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pos_cash_movements_amount_minor_check" CHECK ("amount_minor" > 0),
  CONSTRAINT "pos_cash_movements_reason_check" CHECK (length(btrim("reason")) > 0)
);

CREATE UNIQUE INDEX "pos_cash_movements_tenant_id_id_key"
  ON "pos_cash_movements"("tenant_id", "id");
-- Retrying the same request must not record the movement twice.
CREATE UNIQUE INDEX "pos_cash_movements_session_idempotency_key"
  ON "pos_cash_movements"("tenant_id", "register_session_id", "idempotency_key");
CREATE INDEX "pos_cash_movements_tenant_id_register_session_id_created_at_idx"
  ON "pos_cash_movements"("tenant_id", "register_session_id", "created_at");

ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_tenant_id_outlet_id_fkey"
  FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_tenant_id_register_session_id_fkey"
  FOREIGN KEY ("tenant_id", "register_session_id") REFERENCES "pos_register_sessions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_cash_movements" ADD CONSTRAINT "pos_cash_movements_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
