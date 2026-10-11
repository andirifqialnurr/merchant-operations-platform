-- The PIN a person with approval rights types on someone else's screen to
-- approve an action there, such as a refund (flowchart.md 5.4). One per person
-- per workspace. Only a hash is kept, and wrong tries are counted here so the
-- limit holds on every device.
CREATE TABLE "core_approval_pins" (
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "pin_hash" VARCHAR(255) NOT NULL,
  "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_approval_pins_pkey" PRIMARY KEY ("tenant_id", "user_id"),
  CONSTRAINT "core_approval_pins_failed_attempts_check" CHECK ("failed_attempts" >= 0),
  CONSTRAINT "core_approval_pins_tenant_id_fkey" FOREIGN KEY ("tenant_id")
    REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "core_approval_pins_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
