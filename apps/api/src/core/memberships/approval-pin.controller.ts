import {
  API_HEADERS,
  approvalPinStatusSchema,
  entityIdParamsSchema,
  PERMISSIONS,
  setApprovalPinSchema,
  tenantRequestHeadersSchema,
  type AuthorizationContext,
  type SetApprovalPin,
  type TenantRequestHeaders,
} from "@merchant/contracts";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { SESSION_COOKIE_NAME } from "../auth/public.js";
import { commandOriginFromRequest } from "../../shared/command/command-origin.js";
import { RequestHeaders, ZodValidationPipe } from "../../shared/validation/zod-validation.pipe.js";
import { AccessService } from "./access.service.js";
import { ApprovalPinService } from "./approval-pin.service.js";
import {
  CurrentAccess,
  RequireAllOutlets,
  RequirePermission,
  SessionPermissionGuard,
} from "./session-permission.guard.js";

/** Permissions whose holder can approve an action on someone else's screen. */
const APPROVING_PERMISSIONS = [PERMISSIONS.paymentRefund] as const;

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
export class ApprovalPinController {
  constructor(
    @Inject(ApprovalPinService) private readonly pins: ApprovalPinService,
    @Inject(AccessService) private readonly accessService: AccessService,
  ) {}

  @ApiOperation({ summary: "Whether the signed-in person can approve and has set a PIN" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/ApprovalPinStatus" } })
  @Get("approval-pin")
  async status(@CurrentAccess() access: AuthorizationContext) {
    const canApprove = APPROVING_PERMISSIONS.some((key) => access.permissionKeys.includes(key));
    return approvalPinStatusSchema.parse(
      await this.pins.status(access.tenantId, access.userId, canApprove),
    );
  }

  @ApiOperation({ summary: "Set or replace the signed-in person's own approval PIN" })
  @ApiBody({ schema: { $ref: "#/components/schemas/SetApprovalPin" } })
  @ApiNoContentResponse()
  @RequirePermission(PERMISSIONS.paymentRefund)
  @HttpCode(204)
  @Put("approval-pin")
  async setOwn(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(setApprovalPinSchema)) input: SetApprovalPin,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    await this.pins.setOwn(
      access.tenantId,
      access.userId,
      input.pin,
      commandOriginFromRequest(access.userId, headers),
    );
  }

  @ApiOperation({ summary: "Remove a member's approval PIN so they can set a new one" })
  @ApiNoContentResponse()
  @RequirePermission(PERMISSIONS.accessMembershipManage)
  @RequireAllOutlets()
  @HttpCode(204)
  @Delete("members/:id/approval-pin")
  async reset(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    const tenantId = headers[API_HEADERS.tenantId];
    await this.pins.reset(
      tenantId,
      await this.accessService.memberUserId(tenantId, params.id),
      commandOriginFromRequest(access.userId, headers),
    );
  }
}
