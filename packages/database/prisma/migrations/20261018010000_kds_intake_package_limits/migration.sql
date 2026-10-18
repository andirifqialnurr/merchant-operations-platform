-- Packages & Limits 4.5 and 5.4: standalone KDS Basic has one external
-- source; the standard F&B bundles have internal POS/self-order intake only.
-- Never rewrite published snapshots or move existing subscriptions. A new
-- subscription (or explicit package replacement) chooses the successor.
BEGIN;

DO $$
DECLARE
  previous_version RECORD;
  successor UUID;
  kitchen_package UUID;
  kitchen_version UUID;
BEGIN
  FOR previous_version IN
    SELECT v.* FROM core_package_versions v
    JOIN core_packages p ON p.id = v.package_id
    WHERE p.key IN ('PROFILE', 'POS_BASIC', 'CAFE_DIGITAL', 'CAFE_OPERATIONS')
      AND v.status = 'PUBLISHED'
      AND v.version = (
        SELECT max(current.version) FROM core_package_versions current
        WHERE current.package_id = v.package_id AND current.status = 'PUBLISHED'
      )
      AND NOT EXISTS (
        SELECT 1 FROM core_package_limits l
        WHERE l.package_version_id = v.id AND l.dimension_key = 'kds.intake_sources.active'
      )
  LOOP
    INSERT INTO core_package_versions (package_id, version, template)
    SELECT previous_version.package_id, max(version) + 1, previous_version.template
    FROM core_package_versions WHERE package_id = previous_version.package_id
    RETURNING id INTO successor;

    INSERT INTO core_package_modules (package_version_id, module_key, tier)
    SELECT successor, module_key, tier FROM core_package_modules
    WHERE package_version_id = previous_version.id;

    INSERT INTO core_package_capabilities (package_version_id, capability_key, included)
    SELECT successor, capability_key, included FROM core_package_capabilities
    WHERE package_version_id = previous_version.id;

    INSERT INTO core_package_limits (package_version_id, dimension_key, value, unlimited)
    SELECT successor, dimension_key, value, unlimited FROM core_package_limits
    WHERE package_version_id = previous_version.id;

    INSERT INTO core_package_limits (package_version_id, dimension_key, value)
    VALUES (successor, 'kds.intake_sources.active', 0);

    UPDATE core_package_versions SET status = 'PUBLISHED', published_at = now()
    WHERE id = successor;
  END LOOP;

  INSERT INTO core_packages (key, name) VALUES ('KDS_ONLY', 'KDS Only')
  RETURNING id INTO kitchen_package;

  INSERT INTO core_package_versions (package_id, version)
  VALUES (kitchen_package, 1) RETURNING id INTO kitchen_version;

  INSERT INTO core_package_modules (package_version_id, module_key, tier)
  SELECT kitchen_version, key, 'BASIC'::"ModuleTier" FROM modules
  WHERE kind = 'CORE' OR key = 'KDS';

  INSERT INTO core_package_limits (package_version_id, dimension_key, value) VALUES
    (kitchen_version, 'core.locations.active', 1),
    (kitchen_version, 'core.users.active', 5),
    (kitchen_version, 'kds.devices.active', 2),
    (kitchen_version, 'kds.stations.active_per_location', 1),
    (kitchen_version, 'kds.tickets.created.cycle', 10000),
    (kitchen_version, 'kds.intake_sources.active', 1);

  UPDATE core_package_versions SET status = 'PUBLISHED', published_at = now()
  WHERE id = kitchen_version;
END;
$$;

COMMIT;
