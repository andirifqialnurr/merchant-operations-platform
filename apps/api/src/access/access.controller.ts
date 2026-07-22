import {
  API_HEADERS,
  authorizationContextSchema,
  createMembershipSchema,
  createRoleSchema,
  entityIdParamsSchema,
  membershipSchema,
  PERMISSIONS,
  roleSchema,
  tenantRequestHeadersSchema,
  updateMembershipSchema,
  updateRoleSchema,
  workspaceContextsSchema,
  type AuthorizationContext,
  type CreateMembership,
  type CreateRole,
  type TenantRequestHeaders,
  type UpdateMembership,
  type UpdateRole,
} from "@merchant/contracts";
import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AuthService } from "../auth/auth.service.js";
import { readSessionToken, SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { RequestHeaders, ZodValidationPipe } from "../zod-validation.pipe.js";
import { AccessService } from "./access.service.js";
import {
  CurrentAccess,
  RequireAllOutlets,
  RequirePermission,
  SessionPermissionGuard,
} from "./session-permission.guard.js";

@ApiTags("identity-access")
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiHeader({
  name: API_HEADERS.tenantId,
  required: true,
  schema: { format: "uuid", type: "string" },
})
@ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ValidationError" } })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@Controller("access")
export class AccessController {
  constructor(@Inject(AccessService) private readonly accessService: AccessService) {}

  private mutationContext(access: AuthorizationContext, headers: TenantRequestHeaders) {
    const requestId = headers[API_HEADERS.requestId];
    return { actorId: access.userId, ...(requestId ? { requestId } : {}) };
  }

  @ApiOperation({ summary: "Resolve the active membership and effective access scope" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/AuthorizationContext" } })
  @Get("context")
  context(@CurrentAccess() access: AuthorizationContext) {
    return authorizationContextSchema.parse(access);
  }

  @ApiOperation({ summary: "List roles scoped to the active tenant" })
  @ApiOkResponse({ schema: { items: { $ref: "#/components/schemas/Role" }, type: "array" } })
  @RequirePermission(PERMISSIONS.accessRoleRead)
  @RequireAllOutlets()
  @Get("roles")
  async roles(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
  ) {
    return roleSchema
      .array()
      .parse(await this.accessService.listRoles(headers[API_HEADERS.tenantId]));
  }

  @ApiOperation({ summary: "Create a custom tenant role" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateRole" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/Role" } })
  @RequirePermission(PERMISSIONS.accessRoleManage)
  @RequireAllOutlets()
  @Post("roles")
  async createRole(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createRoleSchema)) input: CreateRole,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return roleSchema.parse(
      await this.accessService.createRole(
        headers[API_HEADERS.tenantId],
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Update a custom tenant role" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateRole" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Role" } })
  @RequirePermission(PERMISSIONS.accessRoleManage)
  @RequireAllOutlets()
  @Patch("roles/:id")
  async updateRole(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateRoleSchema)) input: UpdateRole,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return roleSchema.parse(
      await this.accessService.updateRole(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "List memberships and outlet assignments for the active tenant" })
  @ApiOkResponse({ schema: { items: { $ref: "#/components/schemas/Membership" }, type: "array" } })
  @RequirePermission(PERMISSIONS.accessMembershipManage)
  @RequireAllOutlets()
  @Get("memberships")
  async memberships(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
  ) {
    return membershipSchema
      .array()
      .parse(await this.accessService.listMemberships(headers[API_HEADERS.tenantId]));
  }

  @ApiOperation({ summary: "Create a tenant membership with roles and outlet scope" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateMembership" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/Membership" } })
  @RequirePermission(PERMISSIONS.accessMembershipManage)
  @RequireAllOutlets()
  @Post("memberships")
  async createMembership(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createMembershipSchema)) input: CreateMembership,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return membershipSchema.parse(
      await this.accessService.createMembership(
        headers[API_HEADERS.tenantId],
        input,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Update membership state, roles, or outlet assignments" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateMembership" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Membership" } })
  @RequirePermission(PERMISSIONS.accessMembershipManage)
  @RequireAllOutlets()
  @Patch("memberships/:id")
  async updateMembership(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @Body(new ZodValidationPipe(updateMembershipSchema)) input: UpdateMembership,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return membershipSchema.parse(
      await this.accessService.updateMembership(
        headers[API_HEADERS.tenantId],
        params.id,
        input,
        this.mutationContext(access, headers),
      ),
    );
  }
}

@ApiTags("identity-access")
@ApiCookieAuth(SESSION_COOKIE_NAME)
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@Controller("access")
export class AccessWorkspaceController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AccessService) private readonly accessService: AccessService,
  ) {}

  @ApiOperation({ summary: "List active tenant and outlet contexts for the current session" })
  @ApiOkResponse({
    schema: { items: { $ref: "#/components/schemas/WorkspaceContext" }, type: "array" },
  })
  @Get("workspaces")
  async workspaces(@Headers("cookie") cookieHeader: string | undefined) {
    const session = await this.authService.getSession(readSessionToken(cookieHeader));
    return workspaceContextsSchema.parse(
      await this.accessService.listWorkspaceContexts(session.user.id),
    );
  }
}
