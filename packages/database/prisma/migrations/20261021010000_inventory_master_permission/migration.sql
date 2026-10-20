-- B2b1: master mutation is NOT an operational receive/adjust/stocktake permission.
-- This does not activate Inventory or deliver its capability/HTTP routes.
INSERT INTO "permissions" ("key", "description") VALUES
  ('inventory.master.manage', 'Manage workspace inventory master definitions')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_key")
SELECT "tenant_id", "id", 'inventory.master.manage'
FROM "roles"
WHERE "is_system" = TRUE AND "code" IN ('OWNER', 'MANAGER')
ON CONFLICT DO NOTHING;
