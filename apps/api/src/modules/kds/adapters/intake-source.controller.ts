import {
  API_HEADERS,
  createKdsIntakeSourceSchema,
  entityIdParamsSchema,
  kdsIntakeSourceCreatedSchema,
  kdsIntakeSourceListSchema,
  kdsIntakeSourceSchema,
  MODULES,
  PERMISSIONS,
  tenantRequestHeadersSchema,
  type AuthorizationContext,
  type CreateKdsIntakeSource,
  type TenantRequestHeaders,
} from "@merchant/contracts";
import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import {
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
  RequireAllOutlets,
  RequireModule,
  RequirePermission,
  SessionPermissionGuard,
} from "../../../core/memberships/public.js";
import { commandOriginFromRequest } from "../../../shared/command/command-origin.js";
import {
  RequestHeaders,
  ZodValidationPipe,
} from "../../../shared/validation/zod-validation.pipe.js";
import { IntakeSources } from "../application/intake-sources.js";

/**
 * The keys external systems use to send tickets. Managed by someone who
 * acts for every outlet, never from a device.
 */
@ApiTags("kds")
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiHeader({ name: API_HEADERS.tenantId, required: true })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireModule(MODULES.kds)
@RequireAllOutlets()
@RequirePermission(PERMISSIONS.kdsIntakeManage)
@Controller("kds/intake-sources")
export class IntakeSourceController {
  constructor(@Inject(IntakeSources) private readonly sources: IntakeSources) {}

  @ApiOperation({ summary: "List the external systems that may send kitchen tickets" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/KdsIntakeSourceList" } })
  @Get()
  async list(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
  ) {
    return kdsIntakeSourceListSchema.parse({
      sources: await this.sources.list(headers[API_HEADERS.tenantId]),
    });
  }

  @ApiOperation({ summary: "Add a source; its key is returned only here" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateKdsIntakeSource" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/KdsIntakeSourceCreated" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Post()
  async create(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createKdsIntakeSourceSchema)) input: CreateKdsIntakeSource,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return kdsIntakeSourceCreatedSchema.parse(
      await this.sources.create(
        headers[API_HEADERS.tenantId],
        input,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Revoke a source; its key stops working at once" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/KdsIntakeSource" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @HttpCode(200)
  @Post(":id/revoke")
  async revoke(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return kdsIntakeSourceSchema.parse(
      await this.sources.revoke(
        headers[API_HEADERS.tenantId],
        params.id,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }
}
