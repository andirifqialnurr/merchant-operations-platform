-- Rollout is operational configuration, independent of package capabilities.
CREATE TABLE "core_feature_flags" (
  "key" VARCHAR(120) PRIMARY KEY,
  "status" VARCHAR(16) NOT NULL DEFAULT 'DISABLED',
  "rollout" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "core_feature_flags_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  CONSTRAINT "core_feature_flags_status_check" CHECK ("status" IN ('ENABLED', 'DISABLED')),
  CONSTRAINT "core_feature_flags_rollout_check" CHECK (jsonb_typeof("rollout") = 'object')
);
