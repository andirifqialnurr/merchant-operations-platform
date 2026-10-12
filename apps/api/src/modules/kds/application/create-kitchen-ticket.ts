import {
  createKitchenTicketSchema,
  kitchenTicketSchema,
  type CreateKitchenTicketInput,
  type KitchenTicket,
} from "@merchant/contracts";
import { ConflictException, Inject, Injectable } from "@nestjs/common";

import { MeteringService } from "../../../core/metering/public.js";
import type { CommandOrigin } from "../../../shared/command/command-origin.js";
import type { KitchenTicketRecord } from "../domain/kitchen-ticket.js";
import {
  KITCHEN_TICKET_REPOSITORY,
  type KitchenTicketRepository,
} from "./kitchen-ticket.repository.js";

/** The part of metering this use case needs. */
type UsageRecorder = Pick<MeteringService, "record">;

const iso = (value: Date | null) => value?.toISOString() ?? null;

/** A ticket as the kitchen screen receives it. */
export function toKitchenTicket(record: KitchenTicketRecord): KitchenTicket {
  return kitchenTicketSchema.parse({
    acceptedAt: iso(record.acceptedAt),
    canceledAt: iso(record.canceledAt),
    id: record.id,
    items: record.items,
    orderLabel: record.orderLabel,
    readyAt: iso(record.readyAt),
    receivedAt: record.receivedAt.toISOString(),
    servedAt: iso(record.servedAt),
    source: record.source,
    startedAt: iso(record.startedAt),
    status: record.status,
    tableLabel: record.tableLabel,
  });
}

/**
 * The one way a ticket reaches the kitchen. The manual form, the handler of
 * an order event, and the intake API each turn what they received into the
 * same command and call this; none of them writes a ticket itself.
 *
 * The same source and reference make one ticket however often they arrive,
 * so a repeated event or a retried request changes nothing.
 */
@Injectable()
export class CreateKitchenTicket {
  constructor(
    @Inject(KITCHEN_TICKET_REPOSITORY) private readonly tickets: KitchenTicketRepository,
    @Inject(MeteringService) private readonly metering: UsageRecorder,
  ) {}

  async execute(
    tenantId: string,
    outletId: string,
    input: CreateKitchenTicketInput,
    origin?: CommandOrigin,
  ): Promise<{ created: boolean; ticket: KitchenTicket }> {
    const command = createKitchenTicketSchema.parse(input);
    const { created, ticket } = await this.tickets.create({
      ...(origin?.actorId ? { actorId: origin.actorId } : {}),
      items: command.items.map((item) => ({
        allergyNote: item.allergyNote ?? null,
        modifiers: item.modifiers,
        name: item.name,
        note: item.note ?? null,
        quantity: item.quantity,
      })),
      orderLabel: command.orderLabel,
      outletId,
      receivedAt: command.receivedAt ? new Date(command.receivedAt) : new Date(),
      source: command.source,
      sourceReference: command.sourceReference,
      tableLabel: command.tableLabel ?? null,
      tenantId,
    });
    if (ticket.outletId !== outletId) {
      // The reference already made a ticket somewhere else in the business.
      throw new ConflictException({
        code: "KITCHEN_TICKET_REFERENCE_USED",
        message: "This reference already made a kitchen ticket at another outlet.",
      });
    }
    // Counted once per ticket: the key is the ticket, so a repeat adds nothing.
    await this.metering.record(
      tenantId,
      {
        dimensionKey: "kds.tickets.created.cycle",
        idempotencyKey: `kds.ticket:${ticket.id}`,
        occurredAt: ticket.receivedAt,
        quantity: 1n,
        sourceReference: ticket.id,
        sourceType: "kds_ticket",
      },
      origin,
    );
    return { created, ticket: toKitchenTicket(ticket) };
  }
}
