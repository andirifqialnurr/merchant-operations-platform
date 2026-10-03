import * as z from "zod";

import {
  clientVersionSchema,
  commandChannelSchema,
  idempotencyKeySchema,
  requestIdSchema,
} from "./http.ts";
import { moduleKeySchema } from "./entitlement.ts";
import { moduleEventTypeSchema } from "./module-manifest.ts";

export const eventProducerSchema = moduleKeySchema;

export const eventActorSchema = z.object({
  id: z.uuid().nullable(),
  type: z.enum(["DEVICE", "INTEGRATION", "SYSTEM", "USER"]),
});

export const eventPayloadSchema = z.record(z.string(), z.unknown());

export const domainEventEnvelopeSchema = z.object({
  actor: eventActorSchema.nullable(),
  businessUnitId: z.uuid().nullable(),
  causationId: z.uuid().nullable(),
  /** Where the command that announced the event came from. */
  channel: commandChannelSchema.nullable().optional(),
  clientVersion: clientVersionSchema.nullable().optional(),
  correlationId: requestIdSchema,
  deviceId: z.uuid().nullable().optional(),
  eventId: z.uuid(),
  eventType: moduleEventTypeSchema,
  eventVersion: z.number().int().min(1),
  locationId: z.uuid().nullable(),
  occurredAt: z.iso.datetime(),
  payload: eventPayloadSchema,
  producer: eventProducerSchema,
  recordedAt: z.iso.datetime(),
  workspaceId: z.uuid(),
});

export function createDomainEventEnvelopeSchema<T extends z.ZodType>(payloadSchema: T) {
  return domainEventEnvelopeSchema.extend({ payload: payloadSchema });
}

export const inboxConsumerStatusSchema = z.enum(["BLOCKED", "FAILED", "PROCESSED", "RETRYING"]);

export const inboxConsumerReceiptSchema = z.object({
  consumerName: z.string().trim().min(2).max(120),
  eventId: z.uuid(),
  firstSeenAt: z.iso.datetime(),
  lastError: z.string().trim().min(1).max(500).nullable(),
  lastSeenAt: z.iso.datetime(),
  status: inboxConsumerStatusSchema,
  workspaceId: z.uuid(),
});

export const commandActorTypeSchema = z.enum(["DEVICE", "INTEGRATION", "SYSTEM", "USER"]);

export const commandContextSchema = z
  .object({
    actorId: z.uuid().nullable(),
    actorType: commandActorTypeSchema,
    causationId: z.uuid().nullable(),
    channel: commandChannelSchema,
    clientVersion: clientVersionSchema.nullable(),
    correlationId: requestIdSchema,
    deviceId: z.uuid().nullable(),
    idempotencyKey: idempotencyKeySchema,
    occurredAt: z.iso.datetime(),
    receivedAt: z.iso.datetime(),
    workspaceId: z.uuid(),
  })
  .strict()
  .refine((value) => value.actorType !== "USER" || value.actorId !== null, {
    message: "Command actor USER wajib memiliki actorId.",
    path: ["actorId"],
  })
  .refine((value) => value.actorType !== "DEVICE" || value.deviceId !== null, {
    message: "Command actor DEVICE wajib memiliki deviceId.",
    path: ["deviceId"],
  });

export type DomainEventEnvelope = z.infer<typeof domainEventEnvelopeSchema>;

export type EventActor = z.infer<typeof eventActorSchema>;

export type EventPayload = z.infer<typeof eventPayloadSchema>;

export type EventProducer = z.infer<typeof eventProducerSchema>;

export type CommandActorType = z.infer<typeof commandActorTypeSchema>;

export type CommandChannel = z.infer<typeof commandChannelSchema>;

export type CommandContext = z.infer<typeof commandContextSchema>;

export type InboxConsumerReceipt = z.infer<typeof inboxConsumerReceiptSchema>;

export type InboxConsumerStatus = z.infer<typeof inboxConsumerStatusSchema>;
