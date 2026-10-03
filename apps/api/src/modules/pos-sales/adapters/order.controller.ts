import {
  API_HEADERS,
  cancelOrderSchema,
  checkoutSchema,
  createPosOrderSchema,
  entityIdParamsSchema,
  idempotentRequestHeadersSchema,
  MODULES,
  orderSchema,
  payOrderSchema,
  posOrderListSchema,
  receiptSchema,
  refundOrderSchema,
  saleRefundsSchema,
  PERMISSIONS,
  requestContextHeadersSchema,
  type AuthorizationContext,
  type CancelOrder,
  type CreatePosOrder,
  type IdempotentRequestHeaders,
  type PayOrder,
  type RefundOrder,
  type RequestContextHeaders,
} from "@merchant/contracts";
import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
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
} from "../../../core/memberships/session-permission.guard.js";
import { SESSION_COOKIE_NAME } from "../../../core/auth/session-cookie.js";
import { OrderIntakeService } from "../../../kernels/order-intake/application/order-intake.service.js";
import { RequestHeaders, ZodValidationPipe } from "../../../bootstrap/zod-validation.pipe.js";
import { CheckoutService } from "../application/checkout.service.js";
import { PosOrdersService } from "../application/pos-orders.service.js";

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
  constructor(
    @Inject(OrderIntakeService) private readonly orders: OrderIntakeService,
    @Inject(CheckoutService) private readonly checkout: CheckoutService,
    @Inject(PosOrdersService) private readonly posOrders: PosOrdersService,
  ) {}

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

  @ApiOperation({ summary: "List the outlet's orders of the last 24 hours with payment state" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/PosOrderList" } })
  @RequirePermission(PERMISSIONS.orderCreate)
  @Get()
  async list(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
  ) {
    return posOrderListSchema.parse(
      await this.posOrders.list(headers[API_HEADERS.tenantId], headers[API_HEADERS.outletId]),
    );
  }

  @ApiOperation({ summary: "Cancel an unpaid order with a reason" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CancelOrder" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Order" } })
  @RequirePermission(PERMISSIONS.orderCancel)
  @HttpCode(200)
  @Post(":id/cancel")
  async cancel(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(cancelOrderSchema)) input: CancelOrder,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    const requestId = headers[API_HEADERS.requestId];
    return orderSchema.parse(
      await this.posOrders.cancel(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input,
        { actorId: access.userId, ...(requestId ? { requestId } : {}) },
      ),
    );
  }

  @ApiOperation({ summary: "Refund part or all of a paid order in the cashier's open shift" })
  @ApiHeader({ name: API_HEADERS.idempotencyKey, required: true })
  @ApiBody({ schema: { $ref: "#/components/schemas/RefundOrder" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/SaleRefunds" } })
  @RequirePermission(PERMISSIONS.paymentRefund)
  @HttpCode(200)
  @Post(":id/refunds")
  async refund(
    @RequestHeaders(new ZodValidationPipe(idempotentRequestHeadersSchema))
    headers: IdempotentRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(refundOrderSchema)) input: RefundOrder,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    const requestId = headers[API_HEADERS.requestId];
    return saleRefundsSchema.parse(
      await this.posOrders.refund(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input,
        headers[API_HEADERS.idempotencyKey],
        { actorId: access.userId, ...(requestId ? { requestId } : {}) },
      ),
    );
  }

  @ApiOperation({ summary: "Read the receipt of a paid order" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Receipt" } })
  @RequirePermission(PERMISSIONS.orderCreate)
  @Get(":id/receipt")
  async receipt(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
  ) {
    return receiptSchema.parse(
      await this.posOrders.receipt(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
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

  @ApiOperation({ summary: "Take the full payment of an order in the cashier's open shift" })
  @ApiHeader({ name: API_HEADERS.idempotencyKey, required: true })
  @ApiBody({ schema: { $ref: "#/components/schemas/PayOrder" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Checkout" } })
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
    const requestId = headers[API_HEADERS.requestId];
    return checkoutSchema.parse(
      await this.checkout.payOrder(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input,
        headers[API_HEADERS.idempotencyKey],
        { actorId: access.userId, ...(requestId ? { requestId } : {}) },
      ),
    );
  }
}
