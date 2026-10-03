import {
  API_HEADERS,
  tenantRequestHeadersSchema,
  workspaceNavigationSchema,
  type AuthorizationContext,
  type TenantRequestHeaders,
} from "@merchant/contracts";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { RequestHeaders, ZodValidationPipe } from "../../shared/validation/zod-validation.pipe.js";
import { CurrentAccess, SessionPermissionGuard } from "../memberships/public.js";
import { InstallationService } from "./installation.service.js";

@ApiTags("Modules")
@ApiCookieAuth()
@ApiHeader({ name: API_HEADERS.tenantId, required: true })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@Controller("modules/navigation")
export class NavigationController {
  constructor(@Inject(InstallationService) private readonly service: InstallationService) {}

  @ApiOperation({ summary: "Menu entries the signed-in user can open in this workspace" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/WorkspaceNavigation" } })
  @Get()
  async navigation(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return workspaceNavigationSchema.parse(
      await this.service.navigation(headers[API_HEADERS.tenantId], access.permissionKeys),
    );
  }
}
