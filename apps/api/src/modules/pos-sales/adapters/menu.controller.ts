import {
  API_HEADERS,
  MODULES,
  PERMISSIONS,
  requestContextHeadersSchema,
  sellableMenuSchema,
  type RequestContextHeaders,
} from "@merchant/contracts";
import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import {
  RequireModule,
  RequirePermission,
  SessionPermissionGuard,
} from "../../../access/session-permission.guard.js";
import { SESSION_COOKIE_NAME } from "../../../auth/session-cookie.js";
import { CatalogService } from "../../../catalog/catalog.service.js";
import { RequestHeaders, ZodValidationPipe } from "../../../zod-validation.pipe.js";

/**
 * The menu a cashier sells from. Unlike the backoffice catalog it needs no
 * access to all outlets: it only ever shows the outlet in x-outlet-id.
 */
@ApiTags("pos")
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
@ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireModule(MODULES.pos)
@Controller("pos/menu")
export class MenuController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @ApiOperation({ summary: "Read the products the outlet can sell right now" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/SellableMenu" } })
  @RequirePermission(PERMISSIONS.orderCreate)
  @Get()
  async menu(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
  ) {
    return sellableMenuSchema.parse(
      await this.catalog.getSellableMenu(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
      ),
    );
  }
}
