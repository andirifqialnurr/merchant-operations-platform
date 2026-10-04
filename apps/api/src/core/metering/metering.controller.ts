import {
  API_HEADERS,
  PERMISSIONS,
  subscriptionOverviewSchema,
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
import { EntitlementService } from "../entitlements/public.js";
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
@Controller("subscription")
export class MeteringController {
  constructor(
    @Inject(MeteringService) private readonly service: MeteringService,
    @Inject(EntitlementService) private readonly entitlements: EntitlementService,
  ) {}

  /**
   * What the merchant sees about their own subscription. Overrides, their
   * reasons, and who made them are platform matters and are left out.
   */
  @ApiOperation({ summary: "The workspace's package, its modules with tiers, and usage" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/SubscriptionOverview" } })
  @RequirePermission(PERMISSIONS.organizationRead)
  @Get()
  async overview(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
  ) {
    const tenantId = headers[API_HEADERS.tenantId];
    const [snapshot, meters] = await Promise.all([
      this.entitlements.getSnapshot(tenantId),
      this.service.usage(tenantId),
    ]);
    const subscription = snapshot.subscription;
    return subscriptionOverviewSchema.parse({
      meters,
      modules: snapshot.modules
        .filter((item) => item.enabled && item.kind === "COMMERCIAL" && item.tier !== null)
        .map((item) => ({ key: item.key, tier: item.tier })),
      subscription: subscription
        ? {
            cycleEndsAt: subscription.cycleEndsAt,
            endsAt: subscription.endsAt,
            graceEndsAt: subscription.graceEndsAt,
            planName: subscription.planName,
            status: subscription.status,
          }
        : null,
    });
  }

  @ApiOperation({ summary: "Usage of the workspace against the limits of its package" })
  @ApiOkResponse({ schema: { $ref: "#/components/schemas/UsageSummary" } })
  @RequirePermission(PERMISSIONS.organizationRead)
  @Get("usage")
  async usage(
    @RequestHeaders(new ZodValidationPipe(tenantRequestHeadersSchema))
    headers: TenantRequestHeaders,
  ) {
    return usageSummarySchema.parse({
      meters: await this.service.usage(headers[API_HEADERS.tenantId]),
    });
  }
}
