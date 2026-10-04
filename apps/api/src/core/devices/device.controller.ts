import {
  activateDeviceSchema,
  API_HEADERS,
  deviceActivationTicketSchema,
  deviceListSchema,
  deviceParamsSchema,
  deviceSchema,
  PERMISSIONS,
  platformRequestHeadersSchema,
  registerDeviceSchema,
  tenantRequestHeadersSchema,
  type ActivateDevice,
  type AuthorizationContext,
  type DeviceParams,
  type PlatformRequestHeaders,
  type RegisterDevice,
  type TenantRequestHeaders,
} from "@merchant/contracts";
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Ip,
  Param,
  Post,
  Res,
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
import {
  CurrentAccess,
  RequireAllOutlets,
  RequirePermission,
  SessionPermissionGuard,
} from "../memberships/public.js";
import {
  DEVICE_COOKIE_NAME,
  readDeviceCredential,
  serializeDeviceCookie,
  serializeExpiredDeviceCookie,
} from "./device-credential.js";
import { DeviceService } from "./device.service.js";

type CookieResponse = { setHeader(name: string, value: string): void };

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

/** Managing the devices of a workspace: for people, behind their own session. */
@ApiTags("Devices")
@ApiCookieAuth()
@ApiHeader({ name: API_HEADERS.tenantId, required: true })
@ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@ApiForbiddenResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
@UseGuards(SessionPermissionGuard)
@RequireAllOutlets()
@Controller("devices")
export class DeviceController {
  constructor(@Inject(DeviceService) private readonly service: DeviceService) {}

  @ApiOperation({ summary: "List the devices of the workspace" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/DeviceList" } })
  @RequirePermission(PERMISSIONS.deviceRead)
  @Get()
  async list(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
  ) {
    return deviceListSchema.parse({
      devices: await this.service.list(headers[API_HEADERS.tenantId]),
    });
  }

  @ApiOperation({ summary: "Register a device; the activation code is returned only here" })
  @ApiBody({ schema: { $ref: "#/components/schemas/RegisterDevice" } })
  @ApiCreatedResponse({ schema: { $ref: "#/components/schemas/DeviceActivationTicket" } })
  @ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ValidationError" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.deviceManage)
  @Post()
  async register(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Body(new ZodValidationPipe(registerDeviceSchema)) input: RegisterDevice,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return deviceActivationTicketSchema.parse(
      await this.service.register(
        headers[API_HEADERS.tenantId],
        input,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Issue a new activation code for a device that was never activated" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/DeviceActivationTicket" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.deviceManage)
  @HttpCode(200)
  @Post(":deviceId/activation-code")
  async reissueCode(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(deviceParamsSchema)) params: DeviceParams,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return deviceActivationTicketSchema.parse(
      await this.service.reissueCode(
        headers[API_HEADERS.tenantId],
        params.deviceId,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }

  @ApiOperation({ summary: "Revoke a device; its credential stops working at once" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Device" } })
  @ApiNotFoundResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiConflictResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @RequirePermission(PERMISSIONS.deviceManage)
  @HttpCode(200)
  @Post(":deviceId/revoke")
  async revoke(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
    @Param(new ZodValidationPipe(deviceParamsSchema)) params: DeviceParams,
    @CurrentAccess() access: AuthorizationContext,
  ) {
    return deviceSchema.parse(
      await this.service.revoke(
        headers[API_HEADERS.tenantId],
        params.deviceId,
        commandOriginFromRequest(access.userId, headers),
      ),
    );
  }
}

/**
 * What the device itself calls. No person is signed in here: the activation
 * code, and afterwards the device cookie, are the only proof.
 */
@ApiTags("Devices")
@Controller("device")
export class DeviceSessionController {
  constructor(@Inject(DeviceService) private readonly service: DeviceService) {}

  @ApiOperation({ summary: "Activate this device with its one-time code" })
  @ApiBody({ schema: { $ref: "#/components/schemas/ActivateDevice" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Device" } })
  @ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @ApiTooManyRequestsResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @HttpCode(200)
  @Post("activate")
  async activate(
    @RequestHeaders(new ZodValidationPipe(platformRequestHeadersSchema))
    headers: PlatformRequestHeaders,
    @Body(new ZodValidationPipe(activateDeviceSchema)) input: ActivateDevice,
    @Ip() ipAddress: string,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const requestId = headers[API_HEADERS.requestId];
    const clientVersion = headers[API_HEADERS.clientVersion];
    // Nobody is signed in: the device is about to become the actor.
    const origin: CommandOrigin = {
      channel: headers[API_HEADERS.clientChannel] ?? "API",
      ...(clientVersion ? { clientVersion } : {}),
      ...(requestId ? { requestId } : {}),
    };
    const { credential, device } = await this.service.activate(
      input.code,
      ipAddress ? { ipAddress } : {},
      origin,
    );
    response.setHeader("Set-Cookie", serializeDeviceCookie(credential, isSecureCookie()));
    return deviceSchema.parse(device);
  }

  @ApiCookieAuth(DEVICE_COOKIE_NAME)
  @ApiOperation({ summary: "The device this request comes from" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/Device" } })
  @ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Get("current")
  async current(
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ) {
    const credential = readDeviceCredential(cookieHeader);
    const device = await this.service.authenticate(credential);
    if (!device) {
      // A revoked or unknown credential is of no use to the device: drop it.
      if (credential)
        response.setHeader("Set-Cookie", serializeExpiredDeviceCookie(isSecureCookie()));
      return this.service.requireDevice(undefined);
    }
    return deviceSchema.parse(device);
  }
}
