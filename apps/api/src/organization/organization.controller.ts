import {
  API_HEADERS,
  brandSchema,
  createBrandSchema,
  createOutletSchema,
  entityIdParamsSchema,
  organizationSnapshotSchema,
  outletSchema,
  PERMISSIONS,
  tenantRequestHeadersSchema,
  tenantSchema,
  updateBrandSchema,
  updateOutletSchema,
  updateTenantSchema,
  type AuthorizationContext,
  type CreateBrand,
  type CreateOutlet,
  type TenantRequestHeaders,
  type UpdateBrand,
  type UpdateOutlet,
  type UpdateTenant,
} from "@merchant/contracts";
import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
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
  RequireAllOutlets,
  RequirePermission,
  SessionPermissionGuard,
} from "../access/session-permission.guard.js";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { RequestHeaders, ZodValidationPipe } from "../zod-validation.pipe.js";
import { OrganizationService } from "./organization.service.js";

@ApiTags("organization")
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiHeader({
  name: API_HEADERS.tenantId,
  required: true,
  schema: { format: "uuid", type: "string" },
})
@ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ValidationError" } })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireAllOutlets()
@Controller("organization")
export class OrganizationController {
  constructor(@Inject(OrganizationService) private readonly service: OrganizationService) {}

  private mutationContext(access: AuthorizationContext, headers: TenantRequestHeaders) {
    const requestId = headers[API_HEADERS.requestId];
    return {
      actorId: access.userId,
      ...(requestId ? { requestId } : {}),
    };
  }

  @ApiOperation({ summary: "Read the tenant, brand, and outlet registry for the active tenant" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/OrganizationSnapshot" } })
  @RequirePermission(PERMISSIONS.organizationRead)
  @Get()
  async snapshot(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
  ) {
    return organizationSnapshotSchema.parse(
      await this.service.getSnapshot(headers[API_HEADERS.tenantId]),
    );
  }

  @ApiOperation({ summary: "Update the active tenant registry record" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateTenant" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Tenant" } })
  @RequirePermission(PERMISSIONS.organizationManage)
  @Patch("tenant")
  async updateTenant(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(updateTenantSchema)) input: UpdateTenant,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return tenantSchema.parse(
      await this.service.updateTenant(
        headers[API_HEADERS.tenantId],
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Create a brand inside the active tenant" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateBrand" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/Brand" } })
  @RequirePermission(PERMISSIONS.organizationManage)
  @Post("brands")
  async createBrand(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createBrandSchema)) input: CreateBrand,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return brandSchema.parse(
      await this.service.createBrand(
        headers[API_HEADERS.tenantId],
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Update a brand inside the active tenant" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateBrand" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Brand" } })
  @RequirePermission(PERMISSIONS.organizationManage)
  @Patch("brands/:id")
  async updateBrand(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateBrandSchema)) input: UpdateBrand,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return brandSchema.parse(
      await this.service.updateBrand(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Create an outlet inside the active tenant" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateOutlet" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/Outlet" } })
  @RequirePermission(PERMISSIONS.organizationManage)
  @Post("outlets")
  async createOutlet(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createOutletSchema)) input: CreateOutlet,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return outletSchema.parse(
      await this.service.createOutlet(
        headers[API_HEADERS.tenantId],
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Update an outlet inside the active tenant" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateOutlet" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Outlet" } })
  @RequirePermission(PERMISSIONS.organizationManage)
  @Patch("outlets/:id")
  async updateOutlet(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateOutletSchema)) input: UpdateOutlet,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return outletSchema.parse(
      await this.service.updateOutlet(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        this.mutationContext(access, headers),
      ),
    );
  }
}
