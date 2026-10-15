import { Module } from "@nestjs/common";

import { AuthModule } from "../../core/auth/public.js";
import { AccessModule, SessionPermissionGuard } from "../../core/memberships/public.js";
import { MeteringModule } from "../../core/metering/public.js";
import { OrganizationModule } from "../../core/workspaces/public.js";
import { IntakeSourceController } from "./adapters/intake-source.controller.js";
import { IntakeController } from "./adapters/intake.controller.js";
import { KitchenQueueGateway } from "./adapters/kitchen-queue.gateway.js";
import { KitchenTicketController } from "./adapters/kitchen-ticket.controller.js";
import { OrderEventsHandler } from "./adapters/order-events.handler.js";
import { PrismaIntakeSourceRepository } from "./adapters/prisma-intake-source.repository.js";
import { PrismaKitchenTicketRepository } from "./adapters/prisma-kitchen-ticket.repository.js";
import { AdvanceKitchenTicket } from "./application/advance-kitchen-ticket.js";
import { CancelKitchenTicket } from "./application/cancel-kitchen-ticket.js";
import { CreateKitchenTicket } from "./application/create-kitchen-ticket.js";
import { IntakeKitchenTicket } from "./application/intake-kitchen-ticket.js";
import { INTAKE_SOURCE_REPOSITORY } from "./application/intake-source.repository.js";
import { IntakeSources } from "./application/intake-sources.js";
import { KitchenQueue } from "./application/kitchen-queue.js";
import { KITCHEN_TICKET_REPOSITORY } from "./application/kitchen-ticket.repository.js";

/**
 * Kitchen Display System. Owns kds_stations, kds_tickets, kds_ticket_items,
 * and kds_ticket_status_history. It imports no other module or kernel: what
 * other modules announce reaches it as events, and what it needs to read
 * about an order arrives through KITCHEN_ORDER_SOURCE, connected at the
 * application root.
 */
@Module({
  controllers: [IntakeController, IntakeSourceController, KitchenTicketController],
  exports: [CreateKitchenTicket],
  imports: [AccessModule, AuthModule, MeteringModule, OrganizationModule],
  providers: [
    AdvanceKitchenTicket,
    CancelKitchenTicket,
    OrderEventsHandler,
    CreateKitchenTicket,
    IntakeKitchenTicket,
    IntakeSources,
    KitchenQueue,
    KitchenQueueGateway,
    PrismaKitchenTicketRepository,
    { provide: KITCHEN_TICKET_REPOSITORY, useExisting: PrismaKitchenTicketRepository },
    PrismaIntakeSourceRepository,
    { provide: INTAKE_SOURCE_REPOSITORY, useExisting: PrismaIntakeSourceRepository },
    // The realtime gateway asks the same question as every guarded request.
    SessionPermissionGuard,
  ],
})
export class KdsModule {}
