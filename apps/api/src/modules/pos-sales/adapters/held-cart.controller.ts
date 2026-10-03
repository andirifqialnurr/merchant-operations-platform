import {
  API_HEADERS,
  entityIdParamsSchema,
  heldCartListSchema,
  heldCartSchema,
  holdCartSchema,
  idempotentRequestHeadersSchema,
  MODULES,
  PERMISSIONS,
  requestContextHeadersSchema,
  resumedCartSchema,
  type AuthorizationContext,
  type HoldCart,
  type IdempotentRequestHeaders,
  type RequestContextHeaders,
} from "@merchant/contracts";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
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
import { RequestHeaders, ZodValidationPipe } from "../../../zod-validation.pipe.js";
import { HeldCartService } from "../application/held-cart.service.js";

/** Carts the outlet's cashiers set aside to finish later. */
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
@UseGuards(SessionPermissionGuard)
@RequireModule(MODULES.pos)
@RequirePermission(PERMISSIONS.orderCreate)
@Controller("pos/held-carts")
export class HeldCartController {
  constructor(@Inject(HeldCartService) private readonly carts: HeldCartService) {}

  @ApiOperation({ summary: "List the carts held at the outlet, oldest first" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/HeldCartList" } })
  @Get()
  async list(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
  ) {
    return heldCartListSchema.parse(
      await this.carts.list(headers[API_HEADERS.tenantId], headers[API_HEADERS.outletId]),
    );
  }

  @ApiOperation({ summary: "Set a cart aside under a label" })
  @ApiHeader({ name: API_HEADERS.idempotencyKey, required: true })
  @ApiBody({ schema: { $ref: "#/components/schemas/HoldCart" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/HeldCart" } })
  @Post()
  async hold(
    @RequestHeaders(new ZodValidationPipe(idempotentRequestHeadersSchema))
    headers: IdempotentRequestHeaders,
    @Body(new ZodValidationPipe(holdCartSchema)) input: HoldCart,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return heldCartSchema.parse(
      await this.carts.hold(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        input,
        headers[API_HEADERS.idempotencyKey],
        access.userId,
      ),
    );
  }

  @ApiOperation({ summary: "Take a held cart back to the screen; it is removed from the list" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/ResumedCart" } })
  @HttpCode(200)
  @Post(":id/resume")
  async resume(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
  ) {
    return resumedCartSchema.parse(
      await this.carts.resume(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
      ),
    );
  }

  @ApiOperation({ summary: "Discard a held cart" })
  @ApiNoContentResponse()
  @HttpCode(204)
  @Delete(":id")
  async discard(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
  ) {
    await this.carts.discard(
      headers[API_HEADERS.tenantId],
      headers[API_HEADERS.outletId],
      params.id,
    );
  }
}
