-- Tells the API that an outlet's kitchen queue changed, whichever process
-- wrote it (the API for a manual ticket or a step, the worker for a ticket
-- from an order). The message names the workspace and outlet only; screens
-- read the queue again over REST. Delivered when the transaction commits, so
-- a new ticket's items are there by then.
CREATE FUNCTION "kds_tickets_notify_queue"() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'kds_queue',
    json_build_object('tenantId', NEW."tenant_id", 'outletId', NEW."outlet_id")::text
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "kds_tickets_notify_queue"
  AFTER INSERT OR UPDATE OF "status" ON "kds_tickets"
  FOR EACH ROW EXECUTE FUNCTION "kds_tickets_notify_queue"();
