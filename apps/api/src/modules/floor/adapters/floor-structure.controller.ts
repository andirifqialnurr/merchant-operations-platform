import {
  API_HEADERS,
  createFloorAreaSchema,
  createFloorSchema,
  entityIdParamsSchema,
  floorAreaSchema,
  floorListSchema,
  floorSchema,
  MODULES,
  PERMISSIONS,
  reorderFloorItemsSchema,
  requestContextHeadersSchema,
  updateFloorAreaSchema,
  updateFloorSchema,
  type AuthorizationContext,
  type CreateFloor,
  type CreateFloorArea,
  type ReorderFloorItems,
  type RequestContextHeaders,
  type UpdateFloor,
  type UpdateFloorArea,
} from "@merchant/contracts";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
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
import { FloorStructure } from "../application/floor-structure.js";

/** The floors of the outlet named in the request, and the areas on them. */
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
@RequirePermission(PERMISSIONS.tableLayoutManage)
@Controller("floor")
export class FloorStructureController {
  constructor(@Inject(FloorStructure) private readonly structure: FloorStructure) {}

  @ApiOperation({ summary: "List the outlet's floors with their areas, active or not" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/FloorList" } })
  @Get("floors")
  async list(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
  ) {
    return floorListSchema.parse({
      floors: await this.structure.list(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
      ),
    });
  }

  @ApiOperation({ summary: "Add a floor; it starts with a Main Area" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateFloor" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/Floor" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Post("floors")
  async createFloor(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Body(new ZodValidationPipe(createFloorSchema)) input: CreateFloor,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return floorSchema.parse(
      await this.structure.createFloor(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        input,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Put the outlet's floors in a new order" })
  @ApiBody({ schema: { $ref: "#/components/schemas/ReorderFloorItems" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/FloorList" } })
  @HttpCode(200)
  @Post("floors/order")
  async reorderFloors(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Body(new ZodValidationPipe(reorderFloorItemsSchema)) input: ReorderFloorItems,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return floorListSchema.parse({
      floors: await this.structure.reorderFloors(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        input.ids,
        commandOriginFromRequest(access.userId, headers),
      ),
    });
  }

  @ApiOperation({ summary: "Rename a floor, set it aside, or bring it back" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateFloor" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Floor" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Patch("floors/:id")
  async updateFloor(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateFloorSchema)) input: UpdateFloor,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return floorSchema.parse(
      await this.structure.updateFloor(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Add an area to a floor" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateFloorArea" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/FloorArea" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Post("floors/:id/areas")
  async createArea(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(createFloorAreaSchema)) input: CreateFloorArea,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return floorAreaSchema.parse(
      await this.structure.createArea(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Put a floor's areas in a new order" })
  @ApiBody({ schema: { $ref: "#/components/schemas/ReorderFloorItems" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/FloorList" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @HttpCode(200)
  @Post("floors/:id/areas/order")
  async reorderAreas(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(reorderFloorItemsSchema)) input: ReorderFloorItems,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return floorListSchema.parse({
      floors: await this.structure.reorderAreas(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input.ids,
        commandOriginFromRequest(access.userId, headers),
      ),
    });
  }

  @ApiOperation({ summary: "Rename an area, set it aside, or bring it back" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateFloorArea" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/FloorArea" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Patch("areas/:id")
  async updateArea(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateFloorAreaSchema)) input: UpdateFloorArea,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return floorAreaSchema.parse(
      await this.structure.updateArea(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        input,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }
}
