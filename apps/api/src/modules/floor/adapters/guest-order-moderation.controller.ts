import {
  API_HEADERS,
  acceptGuestOrderSchema,
  rejectGuestOrderSchema,
  entityIdParamsSchema,
  MODULES,
  orderSchema,
  PERMISSIONS,
  requestContextHeadersSchema,
  type AuthorizationContext,
  type RequestContextHeaders,
} from "@merchant/contracts";
import { Body, Controller, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiBody,
  ApiCookieAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { SESSION_COOKIE_NAME } from "../../../core/auth/public.js";
import {
  CurrentAccess,
  RequireModule,
  RequirePermission,
  SessionPermissionGuard,
} from "../../../core/memberships/public.js";
import { OrderIntakeService } from "../../../kernels/order-intake/public.js";
import { commandOriginFromRequest } from "../../../shared/command/command-origin.js";
import {
  RequestHeaders,
  ZodValidationPipe,
} from "../../../shared/validation/zod-validation.pipe.js";

@ApiTags("floor")
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
@ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireModule(MODULES.tableSelfOrder)
@Controller("floor/guest-orders")
export class GuestOrderModerationController {
  constructor(@Inject(OrderIntakeService) private readonly orders: OrderIntakeService) {}

  @ApiOperation({ summary: "Accept a pending guest order and release it to the kitchen" })
  @ApiBody({ schema: { $ref: "#/components/schemas/AcceptGuestOrder" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Order" } })
  @RequirePermission(PERMISSIONS.orderCreate)
  @HttpCode(200)
  @Post(":id/accept")
  async accept(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(acceptGuestOrderSchema)) _input: Record<string, never>,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return orderSchema.parse(
      await this.orders.decideGuestOrder(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        "ACCEPTED",
        null,
        commandOriginFromRequest(access.userId, headers, access.deviceId),
      ),
    );
  }

  @ApiOperation({ summary: "Reject a pending guest order without billing or kitchen preparation" })
  @ApiBody({ schema: { $ref: "#/components/schemas/RejectGuestOrder" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Order" } })
  @RequirePermission(PERMISSIONS.orderCancel)
  @HttpCode(200)
  @Post(":id/reject")
  async reject(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(rejectGuestOrderSchema)) input: { reason: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return orderSchema.parse(
      await this.orders.decideGuestOrder(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        "REJECTED",
        input.reason,
        commandOriginFromRequest(access.userId, headers, access.deviceId),
      ),
    );
  }
}
