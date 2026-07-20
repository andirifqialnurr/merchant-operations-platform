import {
  API_HEADERS,
  createTenantSchema,
  entityIdParamsSchema,
  entitlementSnapshotSchema,
  PLATFORM_PERMISSIONS,
  platformEntitlementParamsSchema,
  platformRequestHeadersSchema,
  platformSetTenantEntitlementSchema,
  platformTenantMasterSchema,
  platformUserSchema,
  replaceSubscriptionSchema,
  tenantSchema,
  updateTenantSchema,
  type CreateTenant,
  type PlatformEntitlementParams,
  type PlatformRequestHeaders,
  type PlatformSetTenantEntitlement,
  type PlatformUser,
  type ReplaceSubscription,
  type UpdateTenant,
} from "@merchant/contracts";
import { Body, Controller, Get, Inject, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
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

import { RequestHeaders, ZodValidationPipe } from "../zod-validation.pipe.js";
import { PlatformMasterService } from "./platform-master.service.js";
import {
  CurrentPlatformUser,
  PlatformPermissionGuard,
  RequirePlatformPermission,
} from "./platform-permission.guard.js";
import { PLATFORM_SESSION_COOKIE_NAME } from "./platform-session-cookie.js";

@ApiTags("platform-master")
@ApiCookieAuth(PLATFORM_SESSION_COOKIE_NAME)
@ApiHeader({ name: API_HEADERS.requestId, required: false, schema: { type: "string" } })
@ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ValidationError" } })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(PlatformPermissionGuard)
@Controller("platform")
export class PlatformMasterController {
  constructor(@Inject(PlatformMasterService) private readonly service: PlatformMasterService) {}

  private mutationContext(user: PlatformUser, headers: PlatformRequestHeaders) {
    const requestId = headers[API_HEADERS.requestId];
    return { actorId: user.id, ...(requestId ? { requestId } : {}) };
  }

  @ApiOperation({ summary: "Return the authenticated platform identity and permissions" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/PlatformUser" } })
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.tenantRead)
  @Get("context")
  context(
    @RequestHeaders(new ZodValidationPipe(platformRequestHeadersSchema))
    _headers: PlatformRequestHeaders,
    @CurrentPlatformUser() user: PlatformUser,
  ) {
    return platformUserSchema.parse(user);
  }

  @ApiOperation({ summary: "Create a tenant registry record from the platform boundary" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateTenant" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/Tenant" } })
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.tenantManage)
  @Post("tenants")
  async createTenant(
    @RequestHeaders(new ZodValidationPipe(platformRequestHeadersSchema))
    headers: PlatformRequestHeaders,
    @Body(new ZodValidationPipe(createTenantSchema)) input: CreateTenant,
    @CurrentPlatformUser() user: PlatformUser,
  ) {
    return tenantSchema.parse(
      await this.service.createTenant(input, this.mutationContext(user, headers)),
    );
  }

  @ApiOperation({ summary: "Read tenant organization and entitlement state as platform staff" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/PlatformTenantMaster" } })
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.tenantRead)
  @Get("tenants/:id")
  async getTenant(
    @RequestHeaders(new ZodValidationPipe(platformRequestHeadersSchema))
    _headers: PlatformRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
  ) {
    return platformTenantMasterSchema.parse(await this.service.getTenant(params.id));
  }

  @ApiOperation({
    summary: "Update tenant identity or lifecycle status from the platform boundary",
  })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateTenant" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Tenant" } })
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.tenantManage)
  @Patch("tenants/:id")
  async updateTenant(
    @RequestHeaders(new ZodValidationPipe(platformRequestHeadersSchema))
    headers: PlatformRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateTenantSchema)) input: UpdateTenant,
    @CurrentPlatformUser() user: PlatformUser,
  ) {
    return tenantSchema.parse(
      await this.service.updateTenant(params.id, input, this.mutationContext(user, headers)),
    );
  }

  @ApiOperation({ summary: "Replace the active tenant subscription from the platform boundary" })
  @ApiBody({ schema: { $ref: "#/components/schemas/ReplaceSubscription" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/EntitlementSnapshot" } })
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.subscriptionManage)
  @Post("tenants/:id/subscriptions")
  async replaceSubscription(
    @RequestHeaders(new ZodValidationPipe(platformRequestHeadersSchema))
    headers: PlatformRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(replaceSubscriptionSchema)) input: ReplaceSubscription,
    @CurrentPlatformUser() user: PlatformUser,
  ) {
    return entitlementSnapshotSchema.parse(
      await this.service.replaceSubscription(params.id, input, this.mutationContext(user, headers)),
    );
  }

  @ApiOperation({ summary: "Set a commercial module override from the platform boundary" })
  @ApiBody({ schema: { $ref: "#/components/schemas/PlatformSetTenantEntitlement" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/EntitlementSnapshot" } })
  @RequirePlatformPermission(PLATFORM_PERMISSIONS.subscriptionManage)
  @Put("tenants/:id/entitlements/:moduleKey")
  async setEntitlement(
    @RequestHeaders(new ZodValidationPipe(platformRequestHeadersSchema))
    headers: PlatformRequestHeaders,
    @Param(new ZodValidationPipe(platformEntitlementParamsSchema))
    params: PlatformEntitlementParams,
    @Body(new ZodValidationPipe(platformSetTenantEntitlementSchema))
    input: PlatformSetTenantEntitlement,
    @CurrentPlatformUser() user: PlatformUser,
  ) {
    return entitlementSnapshotSchema.parse(
      await this.service.setEntitlement(
        params.id,
        params.moduleKey,
        input,
        this.mutationContext(user, headers),
      ),
    );
  }
}
