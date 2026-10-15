import * as z from "zod";

/**
 * Kitchen Display System. A ticket is what the kitchen prepares. It carries
 * no price, no payment, and no customer contact (security.md 10.1); the
 * response schemas are strict so such a field cannot slip through.
 */

/** Where a ticket came from. The kitchen treats all of them the same way. */
export const kitchenTicketSourceSchema = z.enum(["API", "MANUAL", "POS", "SELF_ORDER"]);

export const kitchenTicketStatusSchema = z.enum([
  "NEW",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCELED",
]);

const orderLabelSchema = z.string().trim().min(1).max(60);
const tableLabelSchema = z.string().trim().min(1).max(40);
const itemNameSchema = z.string().trim().min(1).max(160);
/** As long as a note on an order line, so a note from the cashier always fits. */
const itemNoteSchema = z.string().trim().min(1).max(300);
const quantitySchema = z.number().int().min(1).max(999);

export const kitchenTicketItemInputSchema = z
  .object({
    allergyNote: itemNoteSchema.optional(),
    /** Names of the chosen options, in the order they are prepared. */
    modifiers: z.array(itemNameSchema).max(30).default([]),
    name: itemNameSchema,
    note: itemNoteSchema.optional(),
    quantity: quantitySchema,
  })
  .strict();

/**
 * The one shape every way in is turned into before a ticket is made: the
 * manual form, an order event, and the intake API.
 */
export const createKitchenTicketSchema = z
  .object({
    items: z.array(kitchenTicketItemInputSchema).min(1).max(100),
    orderLabel: orderLabelSchema,
    /** When the kitchen was asked; defaults to now. */
    receivedAt: z.iso.datetime().optional(),
    source: kitchenTicketSourceSchema,
    /** What the source calls this request. The same one never makes two tickets. */
    sourceReference: z.string().trim().min(1).max(255),
    tableLabel: tableLabelSchema.optional(),
  })
  .strict();

/** What a person types on the kitchen screen: a label and free items. */
export const createManualKitchenTicketSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            name: itemNameSchema,
            note: itemNoteSchema.optional(),
            quantity: quantitySchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
    orderLabel: orderLabelSchema,
  })
  .strict();

export const kitchenTicketItemSchema = z
  .object({
    allergyNote: z.string().nullable(),
    modifiers: z.array(z.string()),
    name: z.string().min(1),
    note: z.string().nullable(),
    quantity: z.number().int().min(1),
  })
  .strict();

export const kitchenTicketSchema = z
  .object({
    acceptedAt: z.iso.datetime().nullable(),
    canceledAt: z.iso.datetime().nullable(),
    id: z.uuid(),
    items: z.array(kitchenTicketItemSchema).min(1),
    orderLabel: z.string().min(1).max(60),
    readyAt: z.iso.datetime().nullable(),
    receivedAt: z.iso.datetime(),
    servedAt: z.iso.datetime().nullable(),
    source: kitchenTicketSourceSchema,
    startedAt: z.iso.datetime().nullable(),
    status: kitchenTicketStatusSchema,
    tableLabel: z.string().nullable(),
  })
  .strict();

/**
 * Moves a ticket to its next step. The screen says which status it saw, so a
 * second tap or a second screen cannot push the ticket two steps.
 */
export const advanceKitchenTicketSchema = z
  .object({ expectedStatus: kitchenTicketStatusSchema })
  .strict();

/** The outlet's tickets still being worked on, longest waiting first. */
export const kitchenTicketListSchema = z.object({ tickets: z.array(kitchenTicketSchema) }).strict();

/**
 * Realtime for the kitchen screen. The server only says that an outlet's
 * queue changed; the screen reads it again over REST, so nothing a ticket
 * holds travels this way (security.md 10.1, architecture.md 10).
 */
export const KDS_REALTIME = { namespace: "/kds", queueChanged: "queue.changed" } as const;

/** What a kitchen screen says when it connects: the queue it wants to follow. */
export const kitchenRealtimeScopeSchema = z
  .object({ outletId: z.uuid(), tenantId: z.uuid() })
  .strict();

/** The whole message for a changed queue. */
export const kitchenQueueChangedSchema = z.object({ outletId: z.uuid() }).strict();

/** Why the server would not let a screen follow a queue. */
export const kitchenRealtimeRefusalSchema = z.enum([
  "KDS_DEVICE_REQUIRED",
  "ORIGIN_NOT_ALLOWED",
  "REALTIME_ACCESS_DENIED",
]);

export type AdvanceKitchenTicket = z.infer<typeof advanceKitchenTicketSchema>;

export type CreateKitchenTicket = z.infer<typeof createKitchenTicketSchema>;

export type CreateKitchenTicketInput = z.input<typeof createKitchenTicketSchema>;

export type CreateManualKitchenTicket = z.infer<typeof createManualKitchenTicketSchema>;

export type KitchenTicket = z.infer<typeof kitchenTicketSchema>;

export type KitchenQueueChanged = z.infer<typeof kitchenQueueChangedSchema>;

export type KitchenRealtimeRefusal = z.infer<typeof kitchenRealtimeRefusalSchema>;

export type KitchenRealtimeScope = z.infer<typeof kitchenRealtimeScopeSchema>;

export type KitchenTicketItem = z.infer<typeof kitchenTicketItemSchema>;

export type KitchenTicketList = z.infer<typeof kitchenTicketListSchema>;

export type KitchenTicketSource = z.infer<typeof kitchenTicketSourceSchema>;

export type KitchenTicketStatus = z.infer<typeof kitchenTicketStatusSchema>;
