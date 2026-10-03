import {
  API_HEADERS,
  moduleInstallationListSchema,
  moduleInstallationParamsSchema,
  moduleInstallationSchema,
  PERMISSIONS,
  tenantRequestHeadersSchema,
  type AuthorizationContext,
  type ModuleKey,
  type TenantRequestHeaders,
} from "@merchant/contracts";
import { Controller, Delete, Get, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import {
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
import { InstallationService } from "./installation.service.js";
import { commandOriginFromRequest } from "../../shared/command/command-origin.js";

@ApiTags("Modules")
@ApiCookieAuth()
@ApiHeader({ name: API_HEADERS.tenantId, required: true })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireAllOutlets()
@Controller("modules/installations")
export class InstallationController {
  constructor(@Inject(InstallationService) private readonly service: InstallationService) {}

  private mutationContext(access: AuthorizationContext, headers: TenantRequestHeaders) {
    return commandOriginFromRequest(access.userId, headers);
  }

  @ApiOperation({ summary: "List the commercial modules of the workspace with their status" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/ModuleInstallationList" } })
  @RequirePermission(PERMISSIONS.organizationRead)
  @Get()
  async list(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
  ) {
    return moduleInstallationListSchema.parse({
      installations: await this.service.list(headers[API_HEADERS.tenantId]),
    });
  }

  @ApiOperation({ summary: "Install an entitled module; repeating the call changes nothing" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/ModuleInstallation" } })
  @RequirePermission(PERMISSIONS.organizationManage)
  @HttpCode(200)
  @Post(":moduleKey")
  async install(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(moduleInstallationParamsSchema)) params: { moduleKey: ModuleKey },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return moduleInstallationSchema.parse(
      await this.service.install(
        headers[API_HEADERS.tenantId],
        params.moduleKey,
        this.mutationContext(access, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Take a module out of use; its data and settings are kept" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/ModuleInstallation" } })
  @RequirePermission(PERMISSIONS.organizationManage)
  @Delete(":moduleKey")
  async uninstall(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(moduleInstallationParamsSchema)) params: { moduleKey: ModuleKey },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return moduleInstallationSchema.parse(
      await this.service.uninstall(
        headers[API_HEADERS.tenantId],
        params.moduleKey,
        this.mutationContext(access, headers),
      ),
    );
  }
}
