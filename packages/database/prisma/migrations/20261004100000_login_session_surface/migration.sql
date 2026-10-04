-- Session lifetime per surface (security.md SEC-F5). A session opened on a
-- registered device is bound to it: it only works together with that device's
-- credential and ends when the device is revoked. Every other session is a
-- backoffice session with a shorter lifetime.
ALTER TABLE "login_sessions"
  ADD COLUMN "surface" VARCHAR(20) NOT NULL DEFAULT 'BACKOFFICE',
  ADD COLUMN "device_id" UUID;

ALTER TABLE "login_sessions" ADD CONSTRAINT "login_sessions_surface_check"
  CHECK ("surface" IN ('BACKOFFICE', 'POS', 'KDS'));
-- A device session names its device; a backoffice session names none.
ALTER TABLE "login_sessions" ADD CONSTRAINT "login_sessions_device_binding_check"
  CHECK (("surface" = 'BACKOFFICE') = ("device_id" IS NULL));
ALTER TABLE "login_sessions" ADD CONSTRAINT "login_sessions_device_id_fkey"
  FOREIGN KEY ("device_id") REFERENCES "core_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "login_sessions_device_id_idx" ON "login_sessions"("device_id");

-- Sessions opened under the old 30-day rule end no later than the new
-- backoffice lifetime allows.
UPDATE "login_sessions"
SET "expires_at" = LEAST("expires_at", CURRENT_TIMESTAMP + INTERVAL '12 hours')
WHERE "revoked_at" IS NULL AND "expires_at" > CURRENT_TIMESTAMP + INTERVAL '12 hours';
