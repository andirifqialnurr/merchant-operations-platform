import {
  API_HEADERS,
  createPosOrderSchema,
  entityIdParamsSchema,
  idempotentRequestHeadersSchema,
  MODULES,
  orderSchema,
  PERMISSIONS,
  requestContextHeadersSchema,
  type AuthorizationContext,
  type CreatePosOrder,
  type IdempotentRequestHeaders,
  type RequestContextHeaders,
} from "@merchant/contracts";
import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import {
  CurrentAccess,
  RequireModule,
  RequirePermission,
  SessionPermissionGuard,
} from "../../../access/session-permission.guard.js";
import { SESSION_COOKIE_NAME } from "../../../auth/session-cookie.js";
import { OrderIntakeService } from "../../../kernels/order-intake/application/order-intake.service.js";
import { RequestHeaders, ZodValidationPipe } from "../../../zod-validation.pipe.js";

/** Orders taken at the cashier. Pricing and storage belong to order intake. */
@ApiTags("pos")
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
@ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireModule(MODULES.pos)
@Controller("pos/orders")
export class OrderController {
  constructor(@Inject(OrderIntakeService) private readonly orders: OrderIntakeService) {}

  @ApiOperation({ summary: "Submit a cashier order priced from the outlet menu" })
  @ApiHeader({ name: API_HEADERS.idempotencyKey, required: true })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreatePosOrder" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/Order" } })
  @RequirePermission(PERMISSIONS.orderCreate)
  @Post()
  async submit(
    @RequestHeaders(new ZodValidationPipe(idempotentRequestHeadersSchema))
    headers: IdempotentRequestHeaders,
    @Body(new ZodValidationPipe(createPosOrderSchema)) input: CreatePosOrder,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    const requestId = headers[API_HEADERS.requestId];
    return orderSchema.parse(
      await this.orders.submitPosOrder(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        input,
        headers[API_HEADERS.idempotencyKey],
        { actorId: access.userId, ...(requestId ? { requestId } : {}) },
      ),
    );
  }

  @ApiOperation({ summary: "Read one order of the outlet" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Order" } })
  @RequirePermission(PERMISSIONS.orderCreate)
  @Get(":id")
  async get(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
  ) {
    return orderSchema.parse(
      await this.orders.getOrder(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
      ),
    );
  }
}
