-- Where the command that announced an event came from (backend.md 4.1):
-- the channel, the device, and the client version. Correlation, causation,
-- and the actor already have columns. Older events keep these empty.
ALTER TABLE "outbox_events"
  ADD COLUMN "channel" VARCHAR(20),
  ADD COLUMN "device_id" UUID,
  ADD COLUMN "client_version" VARCHAR(80);

ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_channel_check"
  CHECK ("channel" IS NULL OR "channel" IN ('API', 'IMPORT', 'KDS', 'MOBILE', 'POS', 'WEB'));
-- An event announced by a device names that device.
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_device_actor_check"
  CHECK ("actor_type" IS DISTINCT FROM 'DEVICE' OR "device_id" IS NOT NULL);
