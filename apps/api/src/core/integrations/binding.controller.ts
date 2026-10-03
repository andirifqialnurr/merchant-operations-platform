import {
  API_HEADERS,
  entityIdParamsSchema,
  integrationBindingListSchema,
  integrationBindingSchema,
  pauseIntegrationBindingSchema,
  PERMISSIONS,
  tenantRequestHeadersSchema,
  type AuthorizationContext,
  type PauseIntegrationBinding,
  type TenantRequestHeaders,
} from "@merchant/contracts";
import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import {
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

import { RequestHeaders, ZodValidationPipe } from "../../shared/validation/zod-validation.pipe.js";
import {
  CurrentAccess,
  RequireAllOutlets,
  RequirePermission,
  SessionPermissionGuard,
} from "../memberships/public.js";
import { BindingService } from "./binding.service.js";
import { commandOriginFromRequest } from "../../shared/command/command-origin.js";

@ApiTags("Modules")
@ApiCookieAuth()
@ApiHeader({ name: API_HEADERS.tenantId, required: true })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireAllOutlets()
@Controller("modules/bindings")
export class BindingController {
  constructor(@Inject(BindingService) private readonly service: BindingService) {}

  private mutationContext(access: AuthorizationContext, headers: TenantRequestHeaders) {
    return commandOriginFromRequest(access.userId, headers);
  }

  @ApiOperation({ summary: "List the integrations between modules of the workspace" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/IntegrationBindingList" } })
  @RequirePermission(PERMISSIONS.organizationRead)
  @Get()
  async list(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
  ) {
    return integrationBindingListSchema.parse({
      bindings: await this.service.list(headers[API_HEADERS.tenantId]),
    });
  }

  @ApiOperation({ summary: "Stop deliveries through an integration until it is resumed" })
  @ApiBody({ schema: { $ref: "#/components/schemas/PauseIntegrationBinding" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/IntegrationBinding" } })
  @RequirePermission(PERMISSIONS.organizationManage)
  @HttpCode(200)
  @Post(":id/pause")
  async pause(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(pauseIntegrationBindingSchema)) input: PauseIntegrationBinding,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return integrationBindingSchema.parse(
      await this.service.pause(
        headers[API_HEADERS.tenantId],
        params.id,
        input.reason,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Switch a paused or failed integration back on" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/IntegrationBinding" } })
  @RequirePermission(PERMISSIONS.organizationManage)
  @HttpCode(200)
  @Post(":id/resume")
  async resume(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return integrationBindingSchema.parse(
      await this.service.resume(
        headers[API_HEADERS.tenantId],
        params.id,
        this.mutationContext(access, headers),
      ),
    );
  }
}
