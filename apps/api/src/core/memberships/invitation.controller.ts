import {
  acceptInvitationSchema,
  API_HEADERS,
  createInvitationSchema,
  entityIdParamsSchema,
  invitationAcceptedSchema,
  invitationListSchema,
  invitationPreviewSchema,
  invitationSchema,
  invitationTokenRequestSchema,
  PERMISSIONS,
  platformRequestHeadersSchema,
  tenantRequestHeadersSchema,
  type AcceptInvitation,
  type AuthorizationContext,
  type CreateInvitation,
  type InvitationTokenRequest,
  type PlatformRequestHeaders,
  type TenantRequestHeaders,
} from "@merchant/contracts";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Ip,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
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
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import {
  commandOriginFromRequest,
  type CommandOrigin,
} from "../../shared/command/command-origin.js";
import { RequestHeaders, ZodValidationPipe } from "../../shared/validation/zod-validation.pipe.js";
import { InvitationService } from "./invitation.service.js";
import {
  CurrentAccess,
  RequireAllOutlets,
  RequirePermission,
  SessionPermissionGuard,
} from "./session-permission.guard.js";

/** Inviting people: for members who may manage memberships, behind their own session. */
@ApiTags("identity-access")
@ApiCookieAuth()
@ApiHeader({ name: API_HEADERS.tenantId, required: true })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireAllOutlets()
@RequirePermission(PERMISSIONS.accessMembershipManage)
@Controller("access/invitations")
export class InvitationController {
  constructor(@Inject(InvitationService) private readonly service: InvitationService) {}

  @ApiOperation({ summary: "List the invitations of the workspace" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/InvitationList" } })
  @Get()
  async list(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
  ) {
    return invitationListSchema.parse({
      invitations: await this.service.list(headers[API_HEADERS.tenantId]),
    });
  }

  @ApiOperation({ summary: "Invite an email address; the link is sent to that address only" })
  @ApiBody({ schema: { $ref: "#/components/schemas/CreateInvitation" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/Invitation" } })
  @ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ValidationError" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Post()
  async create(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(createInvitationSchema)) input: CreateInvitation,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return invitationSchema.parse(
      await this.service.create(
        headers[API_HEADERS.tenantId],
        input,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Send a fresh link for an open invitation; the old link stops working" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Invitation" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @HttpCode(200)
  @Post(":id/resend")
  async resend(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return invitationSchema.parse(
      await this.service.resend(
        headers[API_HEADERS.tenantId],
        params.id,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Withdraw an open invitation; its link stops working" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Invitation" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @HttpCode(200)
  @Post(":id/revoke")
  async revoke(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(entityIdParamsSchema)) params: { id: string },
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return invitationSchema.parse(
      await this.service.revoke(
        headers[API_HEADERS.tenantId],
        params.id,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }
}

/**
 * What the invited person calls. Nobody is signed in: the secret from the
 * link is the only proof. It travels in the body, never in the address, so
 * it does not end up in access logs.
 */
@ApiTags("identity-access")
@ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiTooManyRequestsResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@Controller("invitations")
export class InvitationAcceptController {
  constructor(@Inject(InvitationService) private readonly service: InvitationService) {}

  @ApiOperation({ summary: "Show who invites and which email is invited" })
  @ApiBody({ schema: { $ref: "#/components/schemas/InvitationTokenRequest" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/InvitationPreview" } })
  @HttpCode(200)
  @Post("preview")
  async preview(
    @Body(new ZodValidationPipe(invitationTokenRequestSchema)) input: InvitationTokenRequest,
    @Ip() ipAddress: string,
  ) {
    return invitationPreviewSchema.parse(
      await this.service.preview(input.token, ipAddress ? { ipAddress } : {}),
    );
  }

  @ApiOperation({ summary: "Accept an invitation, creating the account when there is none" })
  @ApiBody({ schema: { $ref: "#/components/schemas/AcceptInvitation" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/InvitationAccepted" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @HttpCode(200)
  @Post("accept")
  async accept(
    @RequestHeaders(new ZodValidationPipe(platformRequestHeadersSchema))
    headers: PlatformRequestHeaders,
    @Body(new ZodValidationPipe(acceptInvitationSchema)) input: AcceptInvitation,
    @Ip() ipAddress: string,
  ) {
    const requestId = headers[API_HEADERS.requestId];
    const clientVersion = headers[API_HEADERS.clientVersion];
    const origin: CommandOrigin = {
      channel: headers[API_HEADERS.clientChannel] ?? "API",
      ...(clientVersion ? { clientVersion } : {}),
      ...(requestId ? { requestId } : {}),
    };
    return invitationAcceptedSchema.parse(
      await this.service.accept(input, ipAddress ? { ipAddress } : {}, origin),
    );
  }
}
