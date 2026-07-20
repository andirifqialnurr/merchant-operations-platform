import {
  platformRequestHeadersSchema,
  type PlatformPermissionKey,
  type PlatformUser,
} from "@merchant/contracts";
import {
  BadRequestException,
  createParamDecorator,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PlatformAuthService } from "./platform-auth.service.js";
import { readPlatformSessionToken } from "./platform-session-cookie.js";

const REQUIRED_PLATFORM_PERMISSION = "required-platform-permission";

type PlatformAuthorizedRequest = {
  headers: Record<string, string | string[] | undefined>;
  platformUser?: PlatformUser;
};

export const RequirePlatformPermission = (permission: PlatformPermissionKey) =>
  SetMetadata(REQUIRED_PLATFORM_PERMISSION, permission);

export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<PlatformAuthorizedRequest>().platformUser,
);

@Injectable()
export class PlatformPermissionGuard implements CanActivate {
  constructor(
    @Inject(PlatformAuthService) private readonly authService: PlatformAuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<PlatformAuthorizedRequest>();
    const parsedHeaders = platformRequestHeadersSchema.safeParse(request.headers);
    if (!parsedHeaders.success) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        details: {
          issues: parsedHeaders.error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path,
          })),
        },
        message: "Request tidak valid.",
      });
    }

    const cookie = request.headers.cookie;
    const cookieHeader = Array.isArray(cookie) ? cookie[0] : cookie;
    const session = await this.authService.getSession(readPlatformSessionToken(cookieHeader));
    const permission = this.reflector.getAllAndOverride<PlatformPermissionKey | undefined>(
      REQUIRED_PLATFORM_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (permission && !session.user.permissionKeys.includes(permission)) {
      throw new ForbiddenException({
        code: "PLATFORM_AUTHORIZATION_DENIED",
        message: "Anda tidak memiliki akses platform untuk tindakan ini.",
      });
    }
    request.platformUser = session.user;
    return true;
  }
}
