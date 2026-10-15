import {
  API_HEADERS,
  entityIdParamsSchema,
  idempotentRequestHeadersSchema,
  MODULES,
  payOrderSchema,
  PERMISSIONS,
  paymentClaimSchema,
  requestContextHeadersSchema,
  tableSessionCheckoutSchema,
  tableSessionClaimParamsSchema,
  type RequestContextHeaders,
  type AuthorizationContext,
  type IdempotentRequestHeaders,
  type PayOrder,
} from "@merchant/contracts";
import { Body, Controller, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
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
import { CheckoutService } from "../application/checkout.service.js";

/** Paying a table visit at the cashier: every unpaid order of it, at once. */
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
@UseGuards(SessionPermissionGuard)
@RequireModule(MODULES.pos)
@Controller("pos/table-sessions")
export class TableSessionPaymentController {
  constructor(@Inject(CheckoutService) private readonly checkout: CheckoutService) {}

  @ApiOperation({
    summary: "Take one payment for every unpaid order of a table visit in the open shift",
  })
  @ApiHeader({ name: API_HEADERS.idempotencyKey, required: true })
  @ApiBody({ schema: { $ref: "#/components/schemas/PayOrder" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/TableSessionCheckout" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.paymentConfirm)
  @HttpCode(200)
  @Post(":id/payments")
  async pay(
    @RequestHeaders(new ZodValidationPipe(idempotentRequestHeadersSchema))
    headers: IdempotentRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(payOrderSchema)) input: PayOrder,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return tableSessionCheckoutSchema.parse(
      await this.checkout.payTableSession(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input,
        headers[API_HEADERS.idempotencyKey],
        commandOriginFromRequest(access.userId, headers, access.deviceId),
      ),
    );
  }

  @ApiOperation({ summary: "Confirm the guests' transfer or QRIS claim as the visit's payment" })
  @ApiHeader({ name: API_HEADERS.idempotencyKey, required: true })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/TableSessionCheckout" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.paymentConfirm)
  @HttpCode(200)
  @Post(":id/claims/:claimId/confirm")
  async confirmClaim(
    @RequestHeaders(new ZodValidationPipe(idempotentRequestHeadersSchema))
    headers: IdempotentRequestHeaders,
    @Param(new ZodValidationPipe(tableSessionClaimParamsSchema))
    params: { claimId: string; id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return tableSessionCheckoutSchema.parse(
      await this.checkout.confirmClaim(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        params.claimId,
        headers[API_HEADERS.idempotencyKey],
        commandOriginFromRequest(access.userId, headers, access.deviceId),
      ),
    );
  }

  @ApiOperation({ summary: "The guests' payment did not arrive: reject their claim" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/PaymentClaim" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.paymentConfirm)
  @HttpCode(200)
  @Post(":id/claims/:claimId/reject")
  async rejectClaim(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(tableSessionClaimParamsSchema))
    params: { claimId: string; id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return paymentClaimSchema.parse(
      await this.checkout.rejectClaim(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        params.claimId,
        commandOriginFromRequest(access.userId, headers, access.deviceId),
      ),
    );
  }
}
