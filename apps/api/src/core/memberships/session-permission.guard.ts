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
  Optional,
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
import { FeatureFlagService } from "../feature-flags/public.js";
import {
  DEVICE_AUTHENTICATOR,
  readDeviceCredential,
  type DeviceAuthenticator,
} from "../../shared/devices/device-identity.js";

const REQUIRED_PERMISSION = "required-access-permission";
const REQUIRED_MODULE = "required-entitlement-module";
const REQUIRE_ALL_OUTLETS = "require-all-outlets";
const REQUIRED_FEATURE = "required-feature-flag";

type AuthorizedRequest = {
  accessContext?: AuthorizationContext;
  headers: Record<string, string | string[] | undefined>;
};

export const RequirePermission = (permission: PermissionKey) =>
  SetMetadata(REQUIRED_PERMISSION, permission);
export const RequireModule = (moduleKey: ModuleKey) => SetMetadata(REQUIRED_MODULE, moduleKey);
export const RequireAllOutlets = () => SetMetadata(REQUIRE_ALL_OUTLETS, true);
export const RequireFeature = (key: string) => SetMetadata(REQUIRED_FEATURE, key);

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
    @Optional() @Inject(DEVICE_AUTHENTICATOR) private readonly devices?: DeviceAuthenticator,
    @Inject(FeatureFlagService) private readonly featureFlags?: FeatureFlagService,
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
    const deviceCredential = readDeviceCredential(cookieHeader);
    const session = await this.authService.getSession(
      readSessionToken(cookieHeader),
      deviceCredential,
    );
    // A session opened on a device is good for that device's workspace and outlet only.
    const device =
      session.surface && session.surface !== "BACKOFFICE"
        ? await this.devices?.authenticate(deviceCredential)
        : undefined;
    const permission = this.reflector.getAllAndOverride<PermissionKey | undefined>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    const tenantId = parsedHeaders.data[API_HEADERS.tenantId];
    if (device) {
      const outletId = parsedHeaders.data[API_HEADERS.outletId];
      if (device.workspaceId !== tenantId) throw accessDenied("WORKSPACE_ACCESS_DENIED");
      if (outletId && outletId !== device.outletId) throw accessDenied("LOCATION_SCOPE_DENIED");
    }
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
    const featureFlag = this.reflector.getAllAndOverride<string | undefined>(REQUIRED_FEATURE, [
      context.getHandler(),
      context.getClass(),
    ]);

    // One decision, in the order of architecture.md 6.3, with one reason when refused.
    assertAccess(
      evaluateAccess(
        {
          allLocations: access.context.allOutlets && !device,
          capabilities: entitlement.capabilities,
          ...(entitlement.installation ? { installation: entitlement.installation } : {}),
          ...(access.location ? { location: access.location } : {}),
          membershipActive: access.membershipActive,
          ...(entitlement.module ? { module: entitlement.module } : {}),
          permissionKeys: access.context.permissionKeys,
          subscriptionUsable: entitlement.subscriptionUsable,
        },
        {
          // On a device nobody acts for every outlet.
          ...(requireAllOutlets ? { allLocations: true } : {}),
          ...(moduleKey ? { moduleKey } : {}),
          ...(permission ? { permission } : {}),
        },
      ),
    );
    // Check only after subscription, permission and location have passed, so
    // rollout configuration never leaks to a caller who lacks those rights.
    if (featureFlag && !(await this.featureFlags?.enabled(featureFlag, tenantId))) {
      throw accessDenied("FEATURE_DISABLED", { featureFlag });
    }
    request.accessContext = device ? { ...access.context, deviceId: device.id } : access.context;
    return true;
  }
}
