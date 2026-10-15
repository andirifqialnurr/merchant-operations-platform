import {
  API_HEADERS,
  createFloorTableSchema,
  entityIdParamsSchema,
  floorTableListSchema,
  floorTableSchema,
  MODULES,
  PERMISSIONS,
  requestContextHeadersSchema,
  saveFloorLayoutSchema,
  type AuthorizationContext,
  type CreateFloorTable,
  type RequestContextHeaders,
  type SaveFloorLayout,
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
import { FloorTables } from "../application/floor-tables.js";

/** The tables of the outlet named in the request and where they stand. */
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
export class FloorTableController {
  constructor(@Inject(FloorTables) private readonly tables: FloorTables) {}

  @ApiOperation({ summary: "List the outlet's tables, placed or waiting in the tray" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/FloorTableList" } })
  @RequirePermission(PERMISSIONS.tableView)
  @Get("tables")
  async list(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
  ) {
    return floorTableListSchema.parse({
      tables: await this.tables.list(headers[API_HEADERS.tenantId], headers[API_HEADERS.outletId]),
    });
  }

  @ApiOperation({ summary: "Add a table; it waits in the tray until it is placed" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateFloorTable" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/FloorTable" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.tableLayoutManage)
  @Post("tables")
  async create(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Body(new ZodValidationPipe(createFloorTableSchema)) input: CreateFloorTable,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return floorTableSchema.parse(
      await this.tables.create(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        input,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }

  @ApiOperation({
    summary: "Save the tables of a floor that changed in the editor, all or none",
  })
  @ApiBody({ schema: { $ref: "#/components/schemas/SaveFloorLayout" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/FloorTableList" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.tableLayoutManage)
  @HttpCode(200)
  @Put("floors/:id/layout")
  async saveLayout(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(saveFloorLayoutSchema)) input: SaveFloorLayout,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return floorTableListSchema.parse({
      tables: await this.tables.saveLayout(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input.tables,
        commandOriginFromRequest(access.userId, headers),
      ),
    });
  }
}
