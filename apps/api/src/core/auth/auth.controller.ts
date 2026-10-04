import {
  authLoginRequestSchema,
  authLogoutResponseSchema,
  authSessionSchema,
  updateUserPreferencesSchema,
  type AuthLoginRequest,
  type AuthLogoutResponse,
  type AuthSession,
  type UpdateUserPreferences,
} from "@merchant/contracts";
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Ip,
  Patch,
  Post,
  Res,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { ZodValidationPipe } from "../../shared/validation/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import {
  readSessionToken,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  SESSION_COOKIE_NAME,
} from "./session-cookie.js";
import { readDeviceCredential } from "../../shared/devices/device-identity.js";

type CookieResponse = {
  setHeader(name: string, value: string): void;
};

function isSecureCookie() {
  return process.env.NODE_ENV === "production";
}

@ApiTags("identity")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @ApiOperation({ summary: "Create a password-based login session" })
  @ApiBody({ schema: { $ref: "#/components/schemas/AuthLoginRequest" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/AuthSession" } })
  @ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ValidationError" } })
  @ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @HttpCode(200)
  @Post("login")
  async login(
    @Body(new ZodValidationPipe(authLoginRequestSchema)) input: AuthLoginRequest,
    @Ip() ipAddress: string,
    @Headers("user-agent") userAgent: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthSession> {
    const deviceCredential = readDeviceCredential(cookieHeader);
    const result = await this.authService.login(input, {
      ...(deviceCredential ? { deviceCredential } : {}),
      ...(ipAddress ? { ipAddress } : {}),
      ...(userAgent ? { userAgent } : {}),
    });

    response.setHeader(
      "Set-Cookie",
      serializeSessionCookie(result.token, new Date(result.session.expiresAt), isSecureCookie()),
    );

    return authSessionSchema.parse(result.session);
  }

  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @ApiOperation({ summary: "Return the current active login session" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/AuthSession" } })
  @ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Get("session")
  async session(@Headers("cookie") cookieHeader: string | undefined): Promise<AuthSession> {
    return authSessionSchema.parse(
      await this.authService.getSession(
        readSessionToken(cookieHeader),
        readDeviceCredential(cookieHeader),
      ),
    );
  }

  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @ApiOperation({ summary: "Save the signed-in user's language or theme" })
  @ApiBody({ schema: { $ref: "#/components/schemas/UpdateUserPreferences" } })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/AuthSession" } })
  @ApiBadRequestResponse({ schema: { $ref: "#/components/schemas/ValidationError" } })
  @ApiUnauthorizedResponse({ schema: { $ref: "#/components/schemas/ApiError" } })
  @Patch("preferences")
  async updatePreferences(
    @Headers("cookie") cookieHeader: string | undefined,
    @Body(new ZodValidationPipe(updateUserPreferencesSchema)) input: UpdateUserPreferences,
  ): Promise<AuthSession> {
    return authSessionSchema.parse(
      await this.authService.updatePreferences(
        readSessionToken(cookieHeader),
        input,
        readDeviceCredential(cookieHeader),
      ),
    );
  }

  @ApiCookieAuth(SESSION_COOKIE_NAME)
  @ApiOperation({ summary: "Revoke the current login session" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/AuthLogoutResponse" } })
  @HttpCode(200)
  @Post("logout")
  async logout(
    @Headers("cookie") cookieHeader: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthLogoutResponse> {
    const result = await this.authService.logout(readSessionToken(cookieHeader));
    response.setHeader("Set-Cookie", serializeExpiredSessionCookie(isSecureCookie()));
    return authLogoutResponseSchema.parse(result);
  }
}
