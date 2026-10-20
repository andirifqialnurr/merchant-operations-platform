import {
  API_HEADERS,
  MODULES,
  PERMISSIONS,
  entityIdParamsSchema,
  requestContextHeadersSchema,
  visitDocumentSchema,
  type RequestContextHeaders,
} from "@merchant/contracts";
import { Controller, Get, Header, Inject, Param, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from "@nestjs/swagger";

import { SESSION_COOKIE_NAME } from "../../../core/auth/public.js";
import {
  RequireModule,
  RequirePermission,
  SessionPermissionGuard,
} from "../../../core/memberships/public.js";
import {
  RequestHeaders,
  ZodValidationPipe,
} from "../../../shared/validation/zod-validation.pipe.js";
import { ReadVisitDocument } from "../application/read-visit-document.js";

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
@UseGuards(SessionPermissionGuard)
@RequireModule(MODULES.tableSelfOrder)
// Match the existing POS receipt gate; table.view alone cannot read financial documents.
@RequirePermission(PERMISSIONS.orderCreate)
@Controller("floor/sessions")
export class VisitDocumentController {
  constructor(@Inject(ReadVisitDocument) private readonly document: ReadVisitDocument) {}

  @ApiOperation({
    summary: "One consistent visit bill or receipt, with unique payments and refunds",
  })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/VisitDocument" } })
  @ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Header("Cache-Control", "private, no-store")
  @Get(":id/document")
  async read(
    @RequestHeaders(new ZodValidationPipe(requestContextHeadersSchema))
    headers: RequestContextHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
  ) {
    return visitDocumentSchema.parse(
      await this.document.execute(
        headers[API_HEADERS.tenantId],
        headers[API_HEADERS.outletId],
        params.id,
      ),
    );
  }
}
