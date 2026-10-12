import {
  API_HEADERS,
  createManualKitchenTicketSchema,
  idempotentRequestHeadersSchema,
  kitchenTicketListSchema,
  kitchenTicketSchema,
  MODULES,
  PERMISSIONS,
  requestContextHeadersSchema,
  type AuthorizationContext,
  type CreateManualKitchenTicket,
  type IdempotentRequestHeaders,
  type RequestContextHeaders,
} from "@merchant/contracts";
import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { SESSION_COOKIE_NAME } from "../../../core/auth/public.js";
import {
  CurrentAccess,
  RequireModule,
  RequirePermission,
  SessionPermissionGuard,
} from "../../../core/memberships/public.js";
import { commandOriginFromRequest } from "../../../shared/command/command-origin.js";
import {
  RequestHeaders,
  ZodValidationPipe,
} from "../../../shared/validation/zod-validation.pipe.js";
import { CreateKitchenTicket } from "../application/create-kitchen-ticket.js";
import { KitchenQueue } from "../application/kitchen-queue.js";

/** The kitchen screen of one outlet. Nothing here returns a price or a payment. */
@ApiTags("kds")
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiHeader({
  name: API_HEADERS.tenantId,
  required: true,
  schema: { format: "uuid", type: "string" },
})
@ApiHeader({
  name: API_HEADERS.outletId,
  required: true,
  schema: { format: "uuid", type: "string" },
})
@ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ValidationError" } })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireModule(MODULES.kds)
@Controller("kds/tickets")
export class KitchenTicketController {
  constructor(
    @Inject(CreateKitchenTicket) private readonly createTicket: CreateKitchenTicket,
    @Inject(KitchenQueue) private readonly queue: KitchenQueue,
  ) {}

  @ApiOperation({ summary: "List the outlet's tickets still being worked on, oldest first" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/KitchenTicketList" } })
  @RequirePermission(PERMISSIONS.kdsTicketView)
  @Get()
  async list(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
  ) {
    return kitchenTicketListSchema.parse(
      await this.queue.list(headers[API_HEADERS.tenantId], headers[API_HEADERS.outletId]),
    );
  }

  @ApiOperation({ summary: "Add a ticket by hand: a label and free items" })
  @ApiHeader({ name: API_HEADERS.idempotencyKey, required: true })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateManualKitchenTicket" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/KitchenTicket" } })
  @RequirePermission(PERMISSIONS.kdsTicketManage)
  @Post()
  async createManual(
    @RequestHeaders(new ZodValidationPipe(idempotentRequestHeadersSchema))
    headers: IdempotentRequestHeaders,
    @Body(new ZodValidationPipe(createManualKitchenTicketSchema)) input: CreateManualKitchenTicket,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    const { ticket } = await this.createTicket.execute(
      headers[API_HEADERS.tenantId],
      headers[API_HEADERS.outletId],
      {
        items: input.items,
        orderLabel: input.orderLabel,
        source: "MANUAL",
        // A retry of the same request is the same ticket.
        sourceReference: headers[API_HEADERS.idempotencyKey],
      },
      commandOriginFromRequest(access.userId, headers, access.deviceId),
    );
    return kitchenTicketSchema.parse(ticket);
  }
}
