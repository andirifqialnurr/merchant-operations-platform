-- Kitchen Display System (schema.md B.5). The kitchen owns its own tickets:
-- a ticket names where it came from by a source and a reference, and has no
-- foreign key to an order, so a kitchen without the cashier module still works.
-- Nothing here holds a price, a payment, or a customer's contact.

CREATE TYPE "KdsStationStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "KdsTicketSource" AS ENUM ('MANUAL', 'POS', 'SELF_ORDER', 'API');
CREATE TYPE "KdsTicketStatus" AS ENUM (
  'NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELED'
);

CREATE TABLE "kds_stations" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "status" "KdsStationStatus" NOT NULL DEFAULT 'ACTIVE',
  -- The station tickets go to when nothing routes them elsewhere.
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kds_stations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kds_stations_name_check" CHECK (char_length(btrim("name")) >= 1),
  CONSTRAINT "kds_stations_default_active_check" CHECK (NOT "is_default" OR "status" = 'ACTIVE'),
  CONSTRAINT "kds_stations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kds_stations_tenant_id_outlet_id_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "kds_stations_tenant_id_id_key" ON "kds_stations"("tenant_id", "id");
CREATE UNIQUE INDEX "kds_stations_tenant_id_outlet_id_id_key"
  ON "kds_stations"("tenant_id", "outlet_id", "id");
CREATE UNIQUE INDEX "kds_stations_tenant_id_outlet_id_name_key"
  ON "kds_stations"("tenant_id", "outlet_id", "name");
-- One default station per outlet; two first tickets racing create one station.
CREATE UNIQUE INDEX "kds_stations_default_outlet_key"
  ON "kds_stations"("tenant_id", "outlet_id") WHERE "is_default" = TRUE;

CREATE TABLE "kds_tickets" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "outlet_id" UUID NOT NULL,
  "station_id" UUID NOT NULL,
  "source" "KdsTicketSource" NOT NULL,
  -- What the source calls this request: an order ID, an idempotency key, or
  -- the caller's own reference. Not a foreign key.
  "source_reference" VARCHAR(255) NOT NULL,
  "order_label" VARCHAR(60) NOT NULL,
  "table_label" VARCHAR(40),
  "status" "KdsTicketStatus" NOT NULL DEFAULT 'NEW',
  "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accepted_at" TIMESTAMPTZ(6),
  "started_at" TIMESTAMPTZ(6),
  "ready_at" TIMESTAMPTZ(6),
  "served_at" TIMESTAMPTZ(6),
  "canceled_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kds_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kds_tickets_source_reference_check" CHECK (char_length(btrim("source_reference")) >= 1),
  CONSTRAINT "kds_tickets_order_label_check" CHECK (char_length(btrim("order_label")) >= 1),
  CONSTRAINT "kds_tickets_canceled_check" CHECK (("status" = 'CANCELED') = ("canceled_at" IS NOT NULL)),
  CONSTRAINT "kds_tickets_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "kds_tickets_tenant_id_outlet_id_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id") REFERENCES "outlets"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  -- The station must belong to the same outlet as the ticket.
  CONSTRAINT "kds_tickets_station_fkey"
    FOREIGN KEY ("tenant_id", "outlet_id", "station_id")
    REFERENCES "kds_stations"("tenant_id", "outlet_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "kds_tickets_tenant_id_id_key" ON "kds_tickets"("tenant_id", "id");
-- The same request from the same source is one ticket, however often it arrives.
CREATE UNIQUE INDEX "kds_tickets_tenant_id_source_source_reference_key"
  ON "kds_tickets"("tenant_id", "source", "source_reference");
CREATE INDEX "kds_tickets_queue_idx"
  ON "kds_tickets"("tenant_id", "outlet_id", "status", "received_at");

CREATE TABLE "kds_ticket_items" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "ticket_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "name_snapshot" VARCHAR(160) NOT NULL,
  "quantity" INTEGER NOT NULL,
  -- Names of the chosen options, in order. No prices.
  "modifiers" JSONB NOT NULL DEFAULT '[]',
  "note" VARCHAR(280),
  "allergy_note" VARCHAR(280),
  CONSTRAINT "kds_ticket_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kds_ticket_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "kds_ticket_items_position_check" CHECK ("position" >= 0),
  CONSTRAINT "kds_ticket_items_name_check" CHECK (char_length(btrim("name_snapshot")) >= 1),
  CONSTRAINT "kds_ticket_items_modifiers_check" CHECK (jsonb_typeof("modifiers") = 'array'),
  CONSTRAINT "kds_ticket_items_ticket_fkey"
    FOREIGN KEY ("tenant_id", "ticket_id") REFERENCES "kds_tickets"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "kds_ticket_items_ticket_id_position_key"
  ON "kds_ticket_items"("ticket_id", "position");
CREATE INDEX "kds_ticket_items_tenant_id_ticket_id_idx"
  ON "kds_ticket_items"("tenant_id", "ticket_id");

CREATE TABLE "kds_ticket_status_history" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "tenant_id" UUID NOT NULL,
  "ticket_id" UUID NOT NULL,
  -- Null for the first row: the ticket arriving.
  "from_status" "KdsTicketStatus",
  "to_status" "KdsTicketStatus" NOT NULL,
  "actor_id" UUID,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kds_ticket_status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kds_ticket_status_history_ticket_fkey"
    FOREIGN KEY ("tenant_id", "ticket_id") REFERENCES "kds_tickets"("tenant_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "kds_ticket_status_history_ticket_idx"
  ON "kds_ticket_status_history"("tenant_id", "ticket_id", "occurred_at");

-- What happened to a ticket is never rewritten.
CREATE FUNCTION "kds_ticket_status_history_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'kds_ticket_status_history is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "kds_ticket_status_history_append_only"
  BEFORE UPDATE OR DELETE ON "kds_ticket_status_history"
  FOR EACH ROW EXECUTE FUNCTION "kds_ticket_status_history_append_only"();

INSERT INTO "permissions" ("key", "description") VALUES
  ('kds.ticket.view', 'See the kitchen queue'),
  ('kds.ticket.manage', 'Add kitchen tickets and move them through preparation')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_key")
SELECT r."tenant_id", r."id", p."key"
FROM "roles" r
CROSS JOIN (VALUES ('kds.ticket.view'), ('kds.ticket.manage')) AS p("key")
WHERE r."is_system" = TRUE AND r."code" IN ('OWNER', 'MANAGER', 'KITCHEN')
ON CONFLICT DO NOTHING;
