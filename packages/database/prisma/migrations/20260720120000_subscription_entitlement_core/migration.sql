CREATE TYPE "ModuleKind" AS ENUM ('CORE', 'COMMERCIAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'GRACE', 'SUSPENDED', 'TERMINATED');

CREATE TABLE "modules" (
  "key" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "kind" "ModuleKind" NOT NULL,
  "status" "OrganizationUnitStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "modules_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "module_dependencies" (
  "module_key" VARCHAR(80) NOT NULL,
  "dependency_key" VARCHAR(80) NOT NULL,
  CONSTRAINT "module_dependencies_pkey" PRIMARY KEY ("module_key", "dependency_key"),
  CONSTRAINT "module_dependencies_not_self" CHECK ("module_key" <> "dependency_key")
);

CREATE TABLE "plans" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "status" "OrganizationUnitStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plan_modules" (
  "plan_id" UUID NOT NULL,
  "module_key" VARCHAR(80) NOT NULL,
  CONSTRAINT "plan_modules_pkey" PRIMARY KEY ("plan_id", "module_key")
);

CREATE TABLE "subscriptions" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "status" "SubscriptionStatus" NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6),
  "grace_ends_at" TIMESTAMPTZ(6),
  "superseded_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscriptions_date_order" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at"),
  CONSTRAINT "subscriptions_grace_order" CHECK ("grace_ends_at" IS NULL OR "ends_at" IS NULL OR "grace_ends_at" >= "ends_at"),
  CONSTRAINT "subscriptions_grace_required" CHECK ("status" <> 'GRACE' OR ("ends_at" IS NOT NULL AND "grace_ends_at" IS NOT NULL))
);

CREATE TABLE "tenant_entitlements" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "module_key" VARCHAR(80) NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "effective_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "tenant_entitlements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_entitlements_reason_not_blank" CHECK (length(btrim("reason")) >= 3)
);

CREATE INDEX "modules_kind_status_idx" ON "modules"("kind", "status");
CREATE INDEX "module_dependencies_dependency_key_idx" ON "module_dependencies"("dependency_key");
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");
CREATE INDEX "plans_status_created_at_idx" ON "plans"("status", "created_at");
CREATE INDEX "plan_modules_module_key_idx" ON "plan_modules"("module_key");
CREATE UNIQUE INDEX "subscriptions_current_tenant_key" ON "subscriptions"("tenant_id") WHERE "superseded_at" IS NULL;
CREATE INDEX "subscriptions_tenant_id_created_at_idx" ON "subscriptions"("tenant_id", "created_at");
CREATE INDEX "subscriptions_plan_id_status_idx" ON "subscriptions"("plan_id", "status");
CREATE UNIQUE INDEX "tenant_entitlements_tenant_id_module_key_key" ON "tenant_entitlements"("tenant_id", "module_key");
CREATE INDEX "tenant_entitlements_module_key_enabled_idx" ON "tenant_entitlements"("module_key", "enabled");

ALTER TABLE "module_dependencies" ADD CONSTRAINT "module_dependencies_module_key_fkey"
  FOREIGN KEY ("module_key") REFERENCES "modules"("key") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "module_dependencies" ADD CONSTRAINT "module_dependencies_dependency_key_fkey"
  FOREIGN KEY ("dependency_key") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_modules" ADD CONSTRAINT "plan_modules_module_key_fkey"
  FOREIGN KEY ("module_key") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_entitlements" ADD CONSTRAINT "tenant_entitlements_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_entitlements" ADD CONSTRAINT "tenant_entitlements_module_key_fkey"
  FOREIGN KEY ("module_key") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "modules" ("key", "name", "kind", "updated_at") VALUES
  ('CORE_TENANCY', 'Tenancy and Organization Core', 'CORE', CURRENT_TIMESTAMP),
  ('CORE_IDENTITY', 'Identity and Authorization Core', 'CORE', CURRENT_TIMESTAMP),
  ('CORE_SUBSCRIPTION', 'Subscription and Entitlement Core', 'CORE', CURRENT_TIMESTAMP),
  ('CORE_CATALOG', 'Catalog Core', 'CORE', CURRENT_TIMESTAMP),
  ('CORE_ORDER', 'Order Core', 'CORE', CURRENT_TIMESTAMP),
  ('CORE_BILL', 'Bill Core', 'CORE', CURRENT_TIMESTAMP),
  ('CORE_PAYMENT_LEDGER', 'Payment Ledger Core', 'CORE', CURRENT_TIMESTAMP),
  ('CORE_AUDIT', 'Audit and Idempotency Core', 'CORE', CURRENT_TIMESTAMP),
  ('CAFE_PROFILE', 'Cafe Profile', 'COMMERCIAL', CURRENT_TIMESTAMP),
  ('POS', 'POS', 'COMMERCIAL', CURRENT_TIMESTAMP),
  ('TABLE_SELF_ORDER', 'Table Layout and QR Self-Order', 'COMMERCIAL', CURRENT_TIMESTAMP),
  ('KDS', 'Kitchen Display System', 'COMMERCIAL', CURRENT_TIMESTAMP),
  ('INVENTORY_BASIC', 'Inventory Basic', 'COMMERCIAL', CURRENT_TIMESTAMP),
  ('FINANCE_BASIC', 'Finance Basic', 'COMMERCIAL', CURRENT_TIMESTAMP),
  ('CUSTOMER_BASIC', 'Customer Basic', 'COMMERCIAL', CURRENT_TIMESTAMP);

INSERT INTO "module_dependencies" ("module_key", "dependency_key") VALUES
  ('CAFE_PROFILE', 'CORE_CATALOG'),
  ('POS', 'CORE_CATALOG'),
  ('POS', 'CORE_ORDER'),
  ('POS', 'CORE_BILL'),
  ('POS', 'CORE_PAYMENT_LEDGER'),
  ('TABLE_SELF_ORDER', 'CAFE_PROFILE'),
  ('TABLE_SELF_ORDER', 'CORE_CATALOG'),
  ('TABLE_SELF_ORDER', 'CORE_ORDER'),
  ('TABLE_SELF_ORDER', 'CORE_BILL'),
  ('KDS', 'CORE_ORDER'),
  ('INVENTORY_BASIC', 'CORE_CATALOG'),
  ('FINANCE_BASIC', 'CORE_ORDER'),
  ('FINANCE_BASIC', 'CORE_BILL'),
  ('FINANCE_BASIC', 'CORE_PAYMENT_LEDGER'),
  ('CUSTOMER_BASIC', 'CORE_TENANCY');

INSERT INTO "plans" ("id", "code", "name", "updated_at") VALUES
  ('019f7900-0000-7000-8000-000000000001', 'PROFILE', 'Profile', CURRENT_TIMESTAMP),
  ('019f7900-0000-7000-8000-000000000002', 'POS_BASIC', 'POS Basic', CURRENT_TIMESTAMP),
  ('019f7900-0000-7000-8000-000000000003', 'CAFE_DIGITAL', 'Cafe Digital', CURRENT_TIMESTAMP),
  ('019f7900-0000-7000-8000-000000000004', 'CAFE_OPERATIONS', 'Cafe Operations', CURRENT_TIMESTAMP),
  ('019f7900-0000-7000-8000-000000000005', 'CUSTOM_MODULAR', 'Custom Modular', CURRENT_TIMESTAMP);

INSERT INTO "plan_modules" ("plan_id", "module_key") VALUES
  ('019f7900-0000-7000-8000-000000000001', 'CAFE_PROFILE'),
  ('019f7900-0000-7000-8000-000000000002', 'CAFE_PROFILE'),
  ('019f7900-0000-7000-8000-000000000002', 'POS'),
  ('019f7900-0000-7000-8000-000000000003', 'CAFE_PROFILE'),
  ('019f7900-0000-7000-8000-000000000003', 'POS'),
  ('019f7900-0000-7000-8000-000000000003', 'TABLE_SELF_ORDER'),
  ('019f7900-0000-7000-8000-000000000003', 'KDS'),
  ('019f7900-0000-7000-8000-000000000004', 'CAFE_PROFILE'),
  ('019f7900-0000-7000-8000-000000000004', 'POS'),
  ('019f7900-0000-7000-8000-000000000004', 'TABLE_SELF_ORDER'),
  ('019f7900-0000-7000-8000-000000000004', 'KDS'),
  ('019f7900-0000-7000-8000-000000000004', 'INVENTORY_BASIC'),
  ('019f7900-0000-7000-8000-000000000004', 'FINANCE_BASIC'),
  ('019f7900-0000-7000-8000-000000000004', 'CUSTOMER_BASIC');
