import {
  API_HEADERS,
  createTableOrderSchema,
  entityIdParamsSchema,
  idempotentRequestHeadersSchema,
  orderSchema,
  tableSessionDetailSchema,
  floorPolicySchema,
  liveFloorSchema,
  MODULES,
  openTableSessionSchema,
  PERMISSIONS,
  requestContextHeadersSchema,
  tableSessionSchema,
  type AuthorizationContext,
  type CreateTableOrder,
  type IdempotentRequestHeaders,
  type FloorPolicy,
  type OpenTableSession,
  type RequestContextHeaders,
} from "@merchant/contracts";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
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
import { TableSessions } from "../application/table-sessions.js";

/** Who sits where at the outlet named in the request. */
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
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireModule(MODULES.tableSelfOrder)
@Controller("floor")
export class TableSessionController {
  constructor(@Inject(TableSessions) private readonly sessions: TableSessions) {}

  @ApiOperation({ summary: "The live view: floors, every table's status, and open visits" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/LiveFloor" } })
  @RequirePermission(PERMISSIONS.tableView)
  @Get("live")
  async live(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
  ) {
    return liveFloorSchema.parse(
      await this.sessions.live(headers[API_HEADERS.tenantId], headers[API_HEADERS.outletId]),
    );
  }

  @ApiOperation({ summary: "Seat guests at a free table" })
  @ApiBody({ schema: { $ref: "#/components/schemas/OpenTableSession" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/TableSession" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.tableManage)
  @Post("sessions")
  async open(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Body(new ZodValidationPipe(openTableSessionSchema)) input: OpenTableSession,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return tableSessionSchema.parse(
      await this.sessions.open(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        input,
        commandOriginFromRequest(access.userId, headers, access.deviceId),
      ),
    );
  }

  @ApiOperation({ summary: "A visit with its orders and what is still owed" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/TableSessionDetail" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.tableView)
  @Get("sessions/:id")
  async detail(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
  ) {
    return tableSessionDetailSchema.parse(
      await this.sessions.detail(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
      ),
    );
  }

  @ApiOperation({ summary: "Take an order for the guests of a visit; it goes to the kitchen" })
  @ApiHeader({ name: API_HEADERS.idempotencyKey, required: true })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateTableOrder" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/Order" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.orderCreate)
  @Post("sessions/:id/orders")
  async addOrder(
    @RequestHeaders(new ZodValidationPipe(idempotentRequestHeadersSchema))
    headers: IdempotentRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(createTableOrderSchema)) input: CreateTableOrder,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return orderSchema.parse(
      await this.sessions.addOrder(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input,
        headers[API_HEADERS.idempotencyKey],
        commandOriginFromRequest(access.userId, headers, access.deviceId),
      ),
    );
  }

  @ApiOperation({ summary: "End a visit whose orders are all paid or canceled" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/TableSession" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.tableManage)
  @HttpCode(200)
  @Post("sessions/:id/close")
  async close(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return tableSessionSchema.parse(
      await this.sessions.close(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        commandOriginFromRequest(access.userId, headers, access.deviceId),
      ),
    );
  }

  @ApiOperation({ summary: "Mark a table that waited to be cleaned as free" })
  @ApiNoContentResponse()
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.tableManage)
  @HttpCode(204)
  @Post("tables/:id/clean")
  async clean(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    await this.sessions.clean(
      headers[API_HEADERS.tenantId],
      headers[API_HEADERS.outletId],
      params.id,
      commandOriginFromRequest(access.userId, headers, access.deviceId),
    );
  }

  @ApiOperation({ summary: "How the outlet turns its tables around" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/FloorPolicy" } })
  @RequirePermission(PERMISSIONS.tableView)
  @Get("policy")
  async policy(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
  ) {
    return floorPolicySchema.parse(
      await this.sessions.policy(headers[API_HEADERS.tenantId], headers[API_HEADERS.outletId]),
    );
  }

  @ApiOperation({ summary: "Whether closed tables must be cleaned before the next guests" })
  @ApiBody({ schema: { $ref: "#/components/schemas/FloorPolicy" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/FloorPolicy" } })
  @RequirePermission(PERMISSIONS.tableLayoutManage)
  @Put("policy")
  async setPolicy(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Body(new ZodValidationPipe(floorPolicySchema)) input: FloorPolicy,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return floorPolicySchema.parse(
      await this.sessions.setPolicy(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        input,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }
}
