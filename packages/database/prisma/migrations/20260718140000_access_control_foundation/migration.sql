CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "permissions" (
  "key" VARCHAR(120) NOT NULL,
  "description" VARCHAR(255) NOT NULL,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "tenant_memberships" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "all_outlets" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "status" "OrganizationUnitStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
  "tenant_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "permission_key" VARCHAR(120) NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("tenant_id", "role_id", "permission_key")
);

CREATE TABLE "user_roles" (
  "tenant_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("tenant_id", "membership_id", "role_id")
);

CREATE TABLE "outlet_assignments" (
  "tenant_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  CONSTRAINT "outlet_assignments_pkey" PRIMARY KEY ("tenant_id", "membership_id", "outlet_id")
);

CREATE UNIQUE INDEX "outlets_tenant_id_id_key" ON "outlets"("tenant_id", "id");
CREATE UNIQUE INDEX "tenant_memberships_tenant_id_user_id_key" ON "tenant_memberships"("tenant_id", "user_id");
CREATE UNIQUE INDEX "tenant_memberships_tenant_id_id_key" ON "tenant_memberships"("tenant_id", "id");
CREATE INDEX "tenant_memberships_user_id_status_idx" ON "tenant_memberships"("user_id", "status");
CREATE UNIQUE INDEX "roles_tenant_id_code_key" ON "roles"("tenant_id", "code");
CREATE UNIQUE INDEX "roles_tenant_id_id_key" ON "roles"("tenant_id", "id");
CREATE INDEX "roles_tenant_id_status_created_at_idx" ON "roles"("tenant_id", "status", "created_at");
CREATE INDEX "role_permissions_permission_key_idx" ON "role_permissions"("permission_key");
CREATE INDEX "user_roles_tenant_id_role_id_idx" ON "user_roles"("tenant_id", "role_id");
CREATE INDEX "outlet_assignments_tenant_id_outlet_id_idx" ON "outlet_assignments"("tenant_id", "outlet_id");

ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_role_id_fkey"
  FOREIGN KEY ("tenant_id", "role_id") REFERENCES "roles"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_fkey"
  FOREIGN KEY ("permission_key") REFERENCES "permissions"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_membership_id_fkey"
  FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_role_id_fkey"
  FOREIGN KEY ("tenant_id", "role_id") REFERENCES "roles"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outlet_assignments" ADD CONSTRAINT "outlet_assignments_tenant_id_membership_id_fkey"
  FOREIGN KEY ("tenant_id", "membership_id") REFERENCES "tenant_memberships"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outlet_assignments" ADD CONSTRAINT "outlet_assignments_tenant_id_outlet_id_fkey"
  FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "permissions" ("key", "description") VALUES
  ('access.membership.manage', 'Manage tenant memberships and outlet assignments'),
  ('access.role.manage', 'Manage tenant roles and role permissions'),
  ('access.role.read', 'Read tenant roles and their permissions'),
  ('organization.manage', 'Manage tenant, brand, and outlet registry'),
  ('organization.read', 'Read tenant, brand, and outlet registry'),
  ('order.create', 'Create an order'),
  ('order.cancel', 'Cancel an order when policy allows'),
  ('order.move_table', 'Move an order between tables'),
  ('table.view', 'View table operations'),
  ('table.manage', 'Manage table operations'),
  ('table.layout.manage', 'Manage table floor layouts'),
  ('table.qr.manage', 'Manage table QR identities'),
  ('payment.confirm', 'Confirm a payment'),
  ('payment.refund', 'Refund a payment when policy allows'),
  ('payment.reconcile', 'Reconcile recorded payments'),
  ('shift.open', 'Open an operational shift'),
  ('shift.close', 'Close an operational shift'),
  ('cash_variance.approve', 'Approve a cash variance'),
  ('inventory.receive', 'Receive inventory stock'),
  ('inventory.adjust', 'Adjust inventory stock'),
  ('inventory.stocktake', 'Perform an inventory stocktake'),
  ('finance.dashboard.view', 'View the finance dashboard'),
  ('finance.expense.create', 'Create a finance expense'),
  ('finance.report.export', 'Export a finance report');
