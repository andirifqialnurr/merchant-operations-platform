import {
  API_HEADERS,
  entityIdParamsSchema,
  MODULES,
  PERMISSIONS,
  publicQrResolutionSchema,
  publicQrTokenParamsSchema,
  requestContextHeadersSchema,
  tableQrSchema,
  type AuthorizationContext,
  type RequestContextHeaders,
} from "@merchant/contracts";
import { Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
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
import { TableQrCodes } from "../application/table-qr-codes.js";

/** Staff manage the QR of each table at the outlet named in the request. */
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
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireModule(MODULES.tableSelfOrder)
@RequirePermission(PERMISSIONS.tableQrManage)
@Controller("floor/tables/:id/qr")
export class TableQrController {
  constructor(@Inject(TableQrCodes) private readonly codes: TableQrCodes) {}

  @ApiOperation({ summary: "A table's QR: whether it works, and the address to print" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/TableQr" } })
  @Get()
  async get(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
  ) {
    return tableQrSchema.parse(
      await this.codes.get(headers[API_HEADERS.tenantId], headers[API_HEADERS.outletId], params.id),
    );
  }

  @ApiOperation({ summary: "Make the table's QR; asking again returns the working one" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/TableQr" } })
  @HttpCode(200)
  @Post()
  async generate(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return tableQrSchema.parse(
      await this.codes.generate(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Replace the table's QR; printed copies stop working at once" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/TableQr" } })
  @HttpCode(200)
  @Post("rotate")
  async rotate(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return tableQrSchema.parse(
      await this.codes.rotate(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Stop the table's QR; guests can no longer order with it" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/TableQr" } })
  @HttpCode(200)
  @Post("revoke")
  async revoke(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return tableQrSchema.parse(
      await this.codes.revoke(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }
}

/**
 * What a guest's scan leads to. No session: the token is the only key, and
 * the answer holds names only, never an id, a position, or the token itself.
 */
@ApiTags("public")
@Controller("public/table-qr")
export class PublicTableQrController {
  constructor(@Inject(TableQrCodes) private readonly codes: TableQrCodes) {}

  @ApiOperation({ summary: "Resolve a table QR to the business, outlet, and table it belongs to" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/PublicQrResolution" } })
  @Get(":token")
  async resolve(
    @Param(new ZodValidationPipe(publicQrTokenParamsSchema)) params: { token: string },
  ) {
    return publicQrResolutionSchema.parse(await this.codes.resolve(params.token));
  }
}
