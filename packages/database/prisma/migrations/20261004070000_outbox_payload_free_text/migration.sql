-- Events no longer carry text a person typed freely (security.md 6): it can
-- contain someone's name or number. The reason stays in the audit trail and
-- on the source record; this removes it from events written earlier.
UPDATE "outbox_events"
SET "payload" = "payload" - 'reason' - 'note' - 'notes' - 'comment'
WHERE jsonb_typeof("payload") = 'object'
  AND "payload" ?| ARRAY['reason', 'note', 'notes', 'comment'];
