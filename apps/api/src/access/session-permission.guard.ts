import {
  API_HEADERS,
  tenantRequestHeadersSchema,
  type AuthorizationContext,
  type PermissionKey,
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

import { AuthService } from "../auth/auth.service.js";
import { readSessionToken } from "../auth/session-cookie.js";
import { AccessService } from "./access.service.js";

const REQUIRED_PERMISSION = "required-access-permission";
const REQUIRE_ALL_OUTLETS = "require-all-outlets";

type AuthorizedRequest = {
  accessContext?: AuthorizationContext;
  headers: Record<string, string | string[] | undefined>;
};

export const RequirePermission = (permission: PermissionKey) =>
  SetMetadata(REQUIRED_PERMISSION, permission);
export const RequireAllOutlets = () => SetMetadata(REQUIRE_ALL_OUTLETS, true);

export const CurrentAccess = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthorizedRequest>();
  return request.accessContext;
});

@Injectable()
export class SessionPermissionGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AccessService) private readonly accessService: AccessService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const parsedHeaders = tenantRequestHeadersSchema.safeParse(request.headers);
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
    const session = await this.authService.getSession(readSessionToken(cookieHeader));
    const permission = this.reflector.getAllAndOverride<PermissionKey | undefined>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    request.accessContext = await this.accessService.authorize(
      session.user.id,
      parsedHeaders.data[API_HEADERS.tenantId],
      permission,
      parsedHeaders.data[API_HEADERS.outletId],
    );
    const requireAllOutlets = this.reflector.getAllAndOverride<boolean>(REQUIRE_ALL_OUTLETS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requireAllOutlets && !request.accessContext.allOutlets) {
      throw new ForbiddenException({
        code: "AUTHORIZATION_DENIED",
        message: "Anda tidak memiliki akses untuk tindakan ini.",
      });
    }
    return true;
  }
}
