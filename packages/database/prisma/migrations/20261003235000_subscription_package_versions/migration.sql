-- Subscriptions point at the exact package version that was bought, carry
-- their billing cycle, and can hold add-ons (schema.md B.2).
-- `plan_id` stays during the transition (SCH-03).

-- DRAFT: prepared but not started; gives no access.
-- CANCELED_AT_PERIOD_END: canceled, still usable until the period ends.
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCELED_AT_PERIOD_END';

ALTER TABLE "subscriptions"
  ADD COLUMN "package_version_id" UUID,
  ADD COLUMN "cycle_starts_at" TIMESTAMPTZ(6),
  ADD COLUMN "cycle_ends_at" TIMESTAMPTZ(6);

-- Every plan was copied as version 1 of the package with the same id.
UPDATE "subscriptions" s
SET "package_version_id" = v."id",
    "cycle_starts_at" = s."starts_at",
    "cycle_ends_at" = s."ends_at"
FROM "core_package_versions" v
WHERE v."package_id" = s."plan_id" AND v."version" = 1;

ALTER TABLE "subscriptions"
  ALTER COLUMN "package_version_id" SET NOT NULL,
  ALTER COLUMN "cycle_starts_at" SET NOT NULL;

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_package_version_id_fkey"
  FOREIGN KEY ("package_version_id") REFERENCES "core_package_versions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_cycle_check"
  CHECK ("cycle_ends_at" IS NULL OR "cycle_ends_at" > "cycle_starts_at");
CREATE INDEX "subscriptions_package_version_id_idx" ON "subscriptions"("package_version_id");
-- Lets tenant-owned tables reference a subscription together with its tenant.
CREATE UNIQUE INDEX "subscriptions_tenant_id_id_key" ON "subscriptions"("tenant_id", "id");

-- A draft version can still change, so nobody may be subscribed to one.
CREATE FUNCTION "subscription_package_version_guard"() RETURNS trigger AS $$
DECLARE
  version_status "PackageVersionStatus";
BEGIN
  SELECT "status" INTO version_status
  FROM "core_package_versions" WHERE "id" = NEW."package_version_id";
  IF version_status = 'DRAFT' THEN
    RAISE EXCEPTION 'subscription % cannot use package version % while it is a draft',
      NEW."id", NEW."package_version_id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "subscriptions_package_version_guard"
  BEFORE INSERT OR UPDATE OF "package_version_id" ON "subscriptions"
  FOR EACH ROW EXECUTE FUNCTION "subscription_package_version_guard"();

CREATE TABLE "core_subscription_addons" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "subscription_id" UUID NOT NULL,
  "addon_key" VARCHAR(120) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_subscription_addons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_subscription_addons_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "core_subscription_addons_period_check"
    CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at"),
  CONSTRAINT "core_subscription_addons_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  -- The add-on can only belong to a subscription of the same tenant.
  CONSTRAINT "core_subscription_addons_tenant_id_subscription_id_fkey"
    FOREIGN KEY ("tenant_id", "subscription_id") REFERENCES "subscriptions"("tenant_id", "id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "core_subscription_addons_tenant_id_subscription_id_idx"
  ON "core_subscription_addons"("tenant_id", "subscription_id");
CREATE UNIQUE INDEX "core_subscription_addons_subscription_id_addon_key_starts_at_key"
  ON "core_subscription_addons"("subscription_id", "addon_key", "starts_at");
