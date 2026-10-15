-- Customer Basic (M4-BE-09): a name, a phone number, and a note, and the
-- orders a cashier linked to the customer. A link learns its sale from
-- sale.completed.v1, so the history is visits and spend without reading the
-- billing tables.
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "customer_customers" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(120),
  -- Digits with an optional leading "+", as normalized by the API.
  "phone" VARCHAR(16),
  "note" VARCHAR(500),
  "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_customers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_customers_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "customer_customers_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "customer_customers_identity_check" CHECK ("name" IS NOT NULL OR "phone" IS NOT NULL)
);
CREATE UNIQUE INDEX "customer_customers_tenant_id_id_key" ON "customer_customers"("tenant_id", "id");
-- One active customer per phone number in a workspace: the simple duplicate guard.
CREATE UNIQUE INDEX "customer_customers_active_phone_key"
  ON "customer_customers"("tenant_id", "phone") WHERE "status" = 'ACTIVE' AND "phone" IS NOT NULL;
CREATE INDEX "customer_customers_tenant_name_idx" ON "customer_customers"("tenant_id", "name");

CREATE TYPE "CustomerLinkSource" AS ENUM ('ORDER');

CREATE TABLE "customer_order_links" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "source_type" "CustomerLinkSource" NOT NULL DEFAULT 'ORDER',
  -- The order's id; a reference only, the order kernel owns the order.
  "source_reference" UUID NOT NULL,
  "order_number" INTEGER NOT NULL,
  "linked_by" UUID NOT NULL,
  "linked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Filled from sale.completed.v1, or at linking when the order was already paid.
  "sale_number" INTEGER,
  "total_minor" BIGINT,
  "currency" CHAR(3),
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "customer_order_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_order_links_customer_fkey"
    FOREIGN KEY ("tenant_id", "customer_id") REFERENCES "customer_customers"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "customer_order_links_outlet_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "customer_order_links_linked_by_fkey"
    FOREIGN KEY ("linked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "customer_order_links_sale_check"
    CHECK (("sale_number" IS NULL) = ("total_minor" IS NULL))
);
-- An order belongs to at most one customer.
CREATE UNIQUE INDEX "customer_order_links_source_key"
  ON "customer_order_links"("tenant_id", "source_type", "source_reference");
CREATE INDEX "customer_order_links_customer_idx"
  ON "customer_order_links"("tenant_id", "customer_id");

INSERT INTO "permissions" ("key", "description") VALUES
  ('customer.view', 'Find customers and link them to orders'),
  ('customer.manage', 'Add and edit customers'),
  ('customer.contact.view', 'See customers'' phone numbers')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_key")
SELECT r."tenant_id", r."id", p."key"
FROM "roles" r
CROSS JOIN (VALUES ('customer.view'), ('customer.manage'), ('customer.contact.view')) AS p("key")
WHERE r."is_system" = TRUE AND r."code" IN ('OWNER', 'MANAGER')
ON CONFLICT DO NOTHING;

-- Cashiers find and add customers at the till; they see only the last digits of a phone.
INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_key")
SELECT r."tenant_id", r."id", p."key"
FROM "roles" r
CROSS JOIN (VALUES ('customer.view'), ('customer.manage')) AS p("key")
WHERE r."is_system" = TRUE AND r."code" = 'CASHIER'
ON CONFLICT DO NOTHING;
