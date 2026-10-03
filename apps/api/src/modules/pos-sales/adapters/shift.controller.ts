import {
  API_HEADERS,
  closeRegisterSessionSchema,
  currentRegisterSessionSchema,
  entityIdParamsSchema,
  idempotentRequestHeadersSchema,
  MODULES,
  openRegisterSessionSchema,
  PERMISSIONS,
  recordCashMovementSchema,
  registerSessionSchema,
  requestContextHeadersSchema,
  type AuthorizationContext,
  type CloseRegisterSession,
  type IdempotentRequestHeaders,
  type OpenRegisterSession,
  type RecordCashMovement,
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
import { RequestHeaders, ZodValidationPipe } from "../../../bootstrap/zod-validation.pipe.js";
import { ShiftService } from "../application/shift.service.js";

/**
 * HTTP adapter for POS shifts. It only parses and maps; the rules live in
 * ShiftService. Every route is scoped to the outlet in x-outlet-id, which the
 * guard checks against the caller's membership.
 */
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
@Controller("pos/shifts")
export class ShiftController {
  constructor(@Inject(ShiftService) private readonly service: ShiftService) {}

  private context(access: AuthorizationContext, headers: RequestContextHeaders) {
    const requestId = headers[API_HEADERS.requestId];
    return { actorId: access.userId, ...(requestId ? { requestId } : {}) };
  }

  @ApiOperation({ summary: "Read the caller's open shift at the outlet, if any" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/CurrentRegisterSession" } })
  @RequirePermission(PERMISSIONS.shiftOpen)
  @Get("current")
  async current(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return currentRegisterSessionSchema.parse(
      await this.service.getCurrent(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        access.userId,
      ),
    );
  }

  @ApiOperation({ summary: "Open a shift with the opening cash" })
  @ApiBody({ schema: { $ref: "#/components/schemas/OpenRegisterSession" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/RegisterSession" } })
  @RequirePermission(PERMISSIONS.shiftOpen)
  @Post()
  async open(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Body(new ZodValidationPipe(openRegisterSessionSchema)) input: OpenRegisterSession,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return registerSessionSchema.parse(
      await this.service.open(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        input,
        this.context(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Record cash put into or taken out of the drawer" })
  @ApiHeader({ name: API_HEADERS.idempotencyKey, required: true })
  @ApiBody({ schema: { $ref: "#/components/schemas/RecordCashMovement" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/RegisterSession" } })
  @RequirePermission(PERMISSIONS.shiftOpen)
  @HttpCode(200)
  @Post(":id/cash-movements")
  async recordCashMovement(
    @RequestHeaders(new ZodValidationPipe(idempotentRequestHeadersSchema))
    headers: IdempotentRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(recordCashMovementSchema)) input: RecordCashMovement,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return registerSessionSchema.parse(
      await this.service.recordCashMovement(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input,
        headers[API_HEADERS.idempotencyKey],
        this.context(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Close a shift with the counted cash" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CloseRegisterSession" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/RegisterSession" } })
  @RequirePermission(PERMISSIONS.shiftClose)
  @HttpCode(200)
  @Post(":id/close")
  async close(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(closeRegisterSessionSchema)) input: CloseRegisterSession,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return registerSessionSchema.parse(
      await this.service.close(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input,
        this.context(access, headers),
      ),
    );
  }
}
