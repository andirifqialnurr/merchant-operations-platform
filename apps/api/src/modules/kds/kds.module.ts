import { Module } from "@nestjs/common";

import { AuthModule } from "../../core/auth/public.js";
import { AccessModule } from "../../core/memberships/public.js";
import { MeteringModule } from "../../core/metering/public.js";
import { OrganizationModule } from "../../core/workspaces/public.js";
import { KitchenTicketController } from "./adapters/kitchen-ticket.controller.js";
import { PrismaKitchenTicketRepository } from "./adapters/prisma-kitchen-ticket.repository.js";
import { AdvanceKitchenTicket } from "./application/advance-kitchen-ticket.js";
import { CreateKitchenTicket } from "./application/create-kitchen-ticket.js";
import { KitchenQueue } from "./application/kitchen-queue.js";
import { KITCHEN_TICKET_REPOSITORY } from "./application/kitchen-ticket.repository.js";

/**
 * Kitchen Display System. Owns kds_stations, kds_tickets, kds_ticket_items,
 * and kds_ticket_status_history. It imports no other module or kernel: what
 * other modules announce reaches it as events.
 */
@Module({
  controllers: [KitchenTicketController],
  exports: [CreateKitchenTicket],
  imports: [AccessModule, AuthModule, MeteringModule, OrganizationModule],
  providers: [
    AdvanceKitchenTicket,
    CreateKitchenTicket,
    KitchenQueue,
    PrismaKitchenTicketRepository,
    { provide: KITCHEN_TICKET_REPOSITORY, useExisting: PrismaKitchenTicketRepository },
  ],
})
export class KdsModule {}
