-- Versioned packages (schema.md B.2). A package is what is sold; each of its
-- versions fixes the modules, tiers, capability changes, and limits. Once a
-- version is published it never changes: a subscription that points at it
-- must keep meaning the same thing.
--
-- `plans` and `plan_modules` stay in place during the transition (SCH-03);
-- their rows are copied here as version 1 of each package.

CREATE TYPE "PackageVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');
CREATE TYPE "ModuleTier" AS ENUM ('BASIC', 'PRO', 'ADVANCED');

CREATE TABLE "core_packages" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "key" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "status" "OrganizationUnitStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_packages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_packages_key_check" CHECK ("key" ~ '^[A-Z0-9]+(_[A-Z0-9]+)*$')
);
CREATE UNIQUE INDEX "core_packages_key_key" ON "core_packages"("key");

CREATE TABLE "core_package_versions" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "package_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "PackageVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "template" "BusinessTemplate",
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "core_package_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "core_package_versions_version_check" CHECK ("version" >= 1),
  -- A draft has no publication time; anything else has one.
  CONSTRAINT "core_package_versions_published_at_check"
    CHECK (("status" = 'DRAFT') = ("published_at" IS NULL)),
  CONSTRAINT "core_package_versions_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "core_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "core_package_versions_package_id_version_key"
  ON "core_package_versions"("package_id", "version");
CREATE INDEX "core_package_versions_package_id_status_idx"
  ON "core_package_versions"("package_id", "status");

CREATE TABLE "core_package_modules" (
  "package_version_id" UUID NOT NULL,
  "module_key" VARCHAR(80) NOT NULL,
  "tier" "ModuleTier" NOT NULL DEFAULT 'BASIC',
  CONSTRAINT "core_package_modules_pkey" PRIMARY KEY ("package_version_id", "module_key"),
  CONSTRAINT "core_package_modules_package_version_id_fkey"
    FOREIGN KEY ("package_version_id") REFERENCES "core_package_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "core_package_modules_module_key_fkey"
    FOREIGN KEY ("module_key") REFERENCES "modules"("key") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "core_package_modules_module_key_idx" ON "core_package_modules"("module_key");

-- Capabilities added to or removed from what a module's tier gives by default.
CREATE TABLE "core_package_capabilities" (
  "package_version_id" UUID NOT NULL,
  "capability_key" VARCHAR(160) NOT NULL,
  "included" BOOLEAN NOT NULL,
  CONSTRAINT "core_package_capabilities_pkey" PRIMARY KEY ("package_version_id", "capability_key"),
  CONSTRAINT "core_package_capabilities_package_version_id_fkey"
    FOREIGN KEY ("package_version_id") REFERENCES "core_package_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- "Unlimited" is a flag, never a very large number.
CREATE TABLE "core_package_limits" (
  "package_version_id" UUID NOT NULL,
  "dimension_key" VARCHAR(120) NOT NULL,
  "value" BIGINT,
  "unlimited" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "core_package_limits_pkey" PRIMARY KEY ("package_version_id", "dimension_key"),
  CONSTRAINT "core_package_limits_value_check"
    CHECK (("unlimited" AND "value" IS NULL) OR (NOT "unlimited" AND "value" IS NOT NULL AND "value" >= 0)),
  CONSTRAINT "core_package_limits_package_version_id_fkey"
    FOREIGN KEY ("package_version_id") REFERENCES "core_package_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Immutability of published versions is enforced here, not only in the API,
-- so no code path (or manual fix) can change what customers already bought.

CREATE FUNCTION "core_package_version_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'package version % is % and cannot be deleted', OLD."id", OLD."status"
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" = 'DRAFT' THEN
    IF NEW."status" = 'RETIRED' THEN
      RAISE EXCEPTION 'package version % must be published before it is retired', OLD."id"
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- Published or retired: only PUBLISHED -> RETIRED is allowed, nothing else may move.
  IF NEW."package_id" <> OLD."package_id"
    OR NEW."version" <> OLD."version"
    OR NEW."template" IS DISTINCT FROM OLD."template"
    OR NEW."published_at" IS DISTINCT FROM OLD."published_at"
    OR NOT (NEW."status" = OLD."status" OR (OLD."status" = 'PUBLISHED' AND NEW."status" = 'RETIRED'))
  THEN
    RAISE EXCEPTION 'package version % is % and cannot be changed', OLD."id", OLD."status"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "core_package_versions_guard"
  BEFORE UPDATE OR DELETE ON "core_package_versions"
  FOR EACH ROW EXECUTE FUNCTION "core_package_version_guard"();

CREATE FUNCTION "core_package_content_guard"() RETURNS trigger AS $$
DECLARE
  version_id UUID;
  version_status "PackageVersionStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    version_id := OLD."package_version_id";
  ELSE
    version_id := NEW."package_version_id";
  END IF;
  SELECT "status" INTO version_status FROM "core_package_versions" WHERE "id" = version_id;
  -- No parent row means the version itself is being deleted, which its own guard already allowed.
  IF version_status IS NOT NULL AND version_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'package version % is % and its contents cannot be changed', version_id, version_status
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."package_version_id" <> OLD."package_version_id" THEN
    RAISE EXCEPTION 'package contents cannot move to another version'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "core_package_modules_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "core_package_modules"
  FOR EACH ROW EXECUTE FUNCTION "core_package_content_guard"();
CREATE TRIGGER "core_package_capabilities_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "core_package_capabilities"
  FOR EACH ROW EXECUTE FUNCTION "core_package_content_guard"();
CREATE TRIGGER "core_package_limits_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "core_package_limits"
  FOR EACH ROW EXECUTE FUNCTION "core_package_content_guard"();

-- Copy the existing plans: each becomes a package with one published version
-- holding the same modules at the Basic tier. Limits are added with metering.
INSERT INTO "core_packages" ("id", "key", "name", "status", "created_at", "updated_at")
SELECT "id", "code", "name", "status", "created_at", "updated_at" FROM "plans";

INSERT INTO "core_package_versions" ("package_id", "version", "created_at", "updated_at")
SELECT "id", 1, "created_at", "updated_at" FROM "plans";

INSERT INTO "core_package_modules" ("package_version_id", "module_key", "tier")
SELECT v."id", pm."module_key", 'BASIC'
FROM "plan_modules" pm
JOIN "core_package_versions" v ON v."package_id" = pm."plan_id" AND v."version" = 1;

UPDATE "core_package_versions" v
SET "status" = 'PUBLISHED', "published_at" = p."created_at"
FROM "core_packages" p
WHERE p."id" = v."package_id" AND v."version" = 1;
