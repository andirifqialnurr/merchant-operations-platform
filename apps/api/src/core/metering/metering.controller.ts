import {
  API_HEADERS,
  PERMISSIONS,
  tenantRequestHeadersSchema,
  usageSummarySchema,
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
import {
  RequireAllOutlets,
  RequirePermission,
  SessionPermissionGuard,
} from "../memberships/public.js";
import { MeteringService } from "./metering.service.js";

@ApiTags("Subscription")
@ApiCookieAuth()
@ApiHeader({ name: API_HEADERS.tenantId, required: true })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireAllOutlets()
@Controller("subscription/usage")
export class MeteringController {
  constructor(@Inject(MeteringService) private readonly service: MeteringService) {}

  @ApiOperation({ summary: "Usage of the workspace against the limits of its package" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/UsageSummary" } })
  @RequirePermission(PERMISSIONS.organizationRead)
  @Get()
  async usage(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
  ) {
    return usageSummarySchema.parse({
      meters: await this.service.usage(headers[API_HEADERS.tenantId]),
    });
  }
}
