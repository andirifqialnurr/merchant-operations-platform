-- End of the SCH-03 transition. Everything these tables held now lives in the
-- modular core, and no code reads them any more:
--   plans, plan_modules  -> core_packages, core_package_versions, core_package_modules
--   tenant_entitlements  -> core_entitlement_overrides (target type MODULE)
--   subscriptions.plan_id -> subscriptions.package_version_id
--
-- The copies were made by 20261003233000_core_packages and
-- 20261004000000_core_entitlement_overrides. This migration refuses to run if
-- any row would be lost.

DO $$
DECLARE
  missing INTEGER;
BEGIN
  SELECT count(*) INTO missing
  FROM "plans" p
  WHERE NOT EXISTS (SELECT 1 FROM "core_packages" c WHERE c."key" = p."code");
  IF missing > 0 THEN
    RAISE EXCEPTION '% plan(s) have no package; refusing to drop "plans"', missing;
  END IF;

  SELECT count(*) INTO missing
  FROM "plan_modules" pm
  JOIN "plans" p ON p."id" = pm."plan_id"
  WHERE NOT EXISTS (
    SELECT 1
    FROM "core_package_modules" cm
    JOIN "core_package_versions" v ON v."id" = cm."package_version_id"
    JOIN "core_packages" c ON c."id" = v."package_id"
    WHERE c."key" = p."code" AND cm."module_key" = pm."module_key"
  );
  IF missing > 0 THEN
    RAISE EXCEPTION '% plan module(s) are not in any package version; refusing to drop "plan_modules"', missing;
  END IF;

  SELECT count(*) INTO missing
  FROM "tenant_entitlements" te
  WHERE NOT EXISTS (
    SELECT 1 FROM "core_entitlement_overrides" o
    WHERE o."tenant_id" = te."tenant_id"
      AND o."target_type" = 'MODULE'
      AND o."target_key" = te."module_key"
  );
  IF missing > 0 THEN
    RAISE EXCEPTION '% tenant entitlement(s) were not copied; refusing to drop "tenant_entitlements"', missing;
  END IF;
END $$;

ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_plan_id_fkey";
DROP INDEX "subscriptions_plan_id_status_idx";
ALTER TABLE "subscriptions" DROP COLUMN "plan_id";
CREATE INDEX "subscriptions_package_version_id_status_idx"
  ON "subscriptions"("package_version_id", "status");
DROP INDEX "subscriptions_package_version_id_idx";

DROP TABLE "plan_modules";
DROP TABLE "plans";
DROP TABLE "tenant_entitlements";
