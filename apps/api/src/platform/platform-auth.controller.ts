import {
  authLoginRequestSchema,
  authLogoutResponseSchema,
  platformSessionSchema,
  type AuthLoginRequest,
  type AuthLogoutResponse,
  type PlatformSession,
} from "@merchant/contracts";
import { Body, Controller, Get, Headers, HttpCode, Inject, Ip, Post, Res } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { ZodValidationPipe } from "../zod-validation.pipe.js";
import { PlatformAuthService } from "./platform-auth.service.js";
import {
  PLATFORM_SESSION_COOKIE_NAME,
  readPlatformSessionToken,
  serializeExpiredPlatformSessionCookie,
  serializePlatformSessionCookie,
} from "./platform-session-cookie.js";

type CookieResponse = { setHeader(name: string, value: string): void };
const isSecureCookie = () => process.env.NODE_ENV === "production";

@ApiTags("platform-identity")
@Controller("platform/auth")
export class PlatformAuthController {
  constructor(@Inject(PlatformAuthService) private readonly authService: PlatformAuthService) {}

  @ApiOperation({ summary: "Create a separate Platform Owner login session" })
  @ApiBody({ schema: { $ref: "#/components/schemas/AuthLoginRequest" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/PlatformSession" } })
  @ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ValidationError" } })
  @ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @HttpCode(200)
  @Post("login")
  async login(
    @Body(new ZodValidationPipe(authLoginRequestSchema)) input: AuthLoginRequest,
    @Ip() ipAddress: string,
    @Headers("user-agent") userAgent: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<PlatformSession> {
    const result = await this.authService.login(input, {
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
    });
    response.setHeader(
      "Set-Cookie",
      serializePlatformSessionCookie(
        result.token,
        new Date(result.session.expiresAt),
        isSecureCookie(),
      ),
    );
    return platformSessionSchema.parse(result.session);
  }

  @ApiCookieAuth(PLATFORM_SESSION_COOKIE_NAME)
  @ApiOperation({ summary: "Return the active Platform Owner session" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/PlatformSession" } })
  @ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Get("session")
  async session(@Headers("cookie") cookieHeader: string | undefined) {
    return platformSessionSchema.parse(
      await this.authService.getSession(readPlatformSessionToken(cookieHeader)),
    );
  }

  @ApiCookieAuth(PLATFORM_SESSION_COOKIE_NAME)
  @ApiOperation({ summary: "Revoke the active Platform Owner session" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/AuthLogoutResponse" } })
  @HttpCode(200)
  @Post("logout")
  async logout(
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthLogoutResponse> {
    const result = await this.authService.logout(readPlatformSessionToken(cookieHeader));
    response.setHeader("Set-Cookie", serializeExpiredPlatformSessionCookie(isSecureCookie()));
    return authLogoutResponseSchema.parse(result);
  }
}
