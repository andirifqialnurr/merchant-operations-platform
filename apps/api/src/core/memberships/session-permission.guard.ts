import {
  API_HEADERS,
  tenantRequestHeadersSchema,
  type AuthorizationContext,
  type ModuleKey,
  type PermissionKey,
} from "@merchant/contracts";
import {
  BadRequestException,
  createParamDecorator,
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { AuthService } from "../auth/public.js";
import { readSessionToken } from "../auth/public.js";
import {
  accessDenied,
  assertAccess,
  EntitlementService,
  evaluateAccess,
} from "../entitlements/public.js";
import { AccessService } from "./access.service.js";

const REQUIRED_PERMISSION = "required-access-permission";
const REQUIRED_MODULE = "required-entitlement-module";
const REQUIRE_ALL_OUTLETS = "require-all-outlets";

type AuthorizedRequest = {
  accessContext?: AuthorizationContext;
  headers: Record<string, string | string[] | undefined>;
};

export const RequirePermission = (permission: PermissionKey) =>
  SetMetadata(REQUIRED_PERMISSION, permission);
export const RequireModule = (moduleKey: ModuleKey) => SetMetadata(REQUIRED_MODULE, moduleKey);
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
    @Inject(EntitlementService) private readonly entitlementService: EntitlementService,
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
    const tenantId = parsedHeaders.data[API_HEADERS.tenantId];
    const moduleKey = this.reflector.getAllAndOverride<ModuleKey | undefined>(REQUIRED_MODULE, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requireAllOutlets = this.reflector.getAllAndOverride<boolean>(REQUIRE_ALL_OUTLETS, [
      context.getHandler(),
      context.getClass(),
    ]);

    const access = await this.accessService.describeAccess(
      session.user.id,
      tenantId,
      parsedHeaders.data[API_HEADERS.outletId],
    );
    // Someone outside the workspace learns nothing about its subscription.
    if (!access.context) throw accessDenied("WORKSPACE_ACCESS_DENIED");
    const entitlement = await this.entitlementService.describeAccess(tenantId, moduleKey);

    // One decision, in the order of architecture.md 6.3, with one reason when refused.
    assertAccess(
      evaluateAccess(
        {
          allLocations: access.context.allOutlets,
          capabilities: entitlement.capabilities,
          ...(entitlement.installation ? { installation: entitlement.installation } : {}),
          ...(access.location ? { location: access.location } : {}),
          membershipActive: access.membershipActive,
          ...(entitlement.module ? { module: entitlement.module } : {}),
          permissionKeys: access.context.permissionKeys,
          subscriptionUsable: entitlement.subscriptionUsable,
        },
        {
          ...(requireAllOutlets ? { allLocations: true } : {}),
          ...(moduleKey ? { moduleKey } : {}),
          ...(permission ? { permission } : {}),
        },
      ),
    );
    request.accessContext = access.context;
    return true;
  }
}
