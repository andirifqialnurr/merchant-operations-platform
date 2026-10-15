import {
  intakeKitchenTicketResultSchema,
  intakeKitchenTicketSchema,
  MODULES,
  type IntakeKitchenTicket as IntakeRequest,
} from "@merchant/contracts";
import { Inject, Injectable, Optional, UnauthorizedException } from "@nestjs/common";

import {
  assertAccess,
  EntitlementService,
  evaluateAccess,
} from "../../../core/entitlements/public.js";
import {
  InMemoryRateLimitService,
  RATE_LIMIT_SERVICE,
  type RateLimitPolicy,
  type RateLimitService,
} from "../../../core/security/public.js";
import type { CommandOrigin } from "../../../shared/command/command-origin.js";
import { readIntakeKey, secretMatches } from "../domain/intake-key.js";
import { CreateKitchenTicket } from "./create-kitchen-ticket.js";
import {
  INTAKE_SOURCE_REPOSITORY,
  type IntakeSourceRecord,
  type IntakeSourceRepository,
} from "./intake-source.repository.js";

/** What every package with the kitchen screen includes; Pro adds `kds.intake.api`. */
export const INTAKE_CAPABILITY = "kds.intake.api_lite";
export const INTAKE_PRO_CAPABILITY = "kds.intake.api";

/**
 * Requests per minute for one source (packages-limits 5.4): 60 on KDS Basic,
 * 600 when the package includes the Pro intake. A wrong key is limited per
 * network address, so hammering costs the caller and not the database.
 */
export const INTAKE_RATE_LIMITS = {
  basic: { limit: 60, windowMs: 60_000 },
  invalidKey: { limit: 30, windowMs: 60_000 },
  pro: { limit: 600, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;

function invalidKey() {
  // A missing, malformed, wrong, or revoked key all get the same answer.
  return new UnauthorizedException({
    code: "KDS_INTAKE_KEY_INVALID",
    message: "The intake key is missing, wrong, or revoked.",
  });
}

/**
 * The third way into the kitchen (M3-BE-08): an external system with its own
 * key. The ticket is made by the same use case as the manual form and the
 * cashier's orders; the key decides the workspace and outlet.
 */
@Injectable()
export class IntakeKitchenTicket {
  constructor(
    @Inject(INTAKE_SOURCE_REPOSITORY) private readonly sources: IntakeSourceRepository,
    @Inject(CreateKitchenTicket) private readonly createTicket: CreateKitchenTicket,
    @Inject(EntitlementService) private readonly entitlements: EntitlementService,
    @Optional()
    @Inject(RATE_LIMIT_SERVICE)
    private readonly rateLimit: RateLimitService = new InMemoryRateLimitService(),
  ) {}

  /** The active source behind an `Authorization` header, or a refusal. */
  async authenticate(
    authorization: string | undefined,
    ipAddress?: string,
  ): Promise<IntakeSourceRecord> {
    const key = readIntakeKey(authorization);
    const source = key ? await this.sources.findActiveByPrefix(key.prefix) : null;
    if (!key || !source || !secretMatches(key.secret, source.secretHash)) {
      // Counted only when it fails; past the limit the answer is 429 instead.
      await this.rateLimit.consume(
        `kds-intake-invalid:${ipAddress?.trim() || "unknown"}`,
        INTAKE_RATE_LIMITS.invalidKey,
      );
      throw invalidKey();
    }
    return source;
  }

  async execute(
    source: IntakeSourceRecord,
    input: IntakeRequest,
    origin: CommandOrigin = {},
    now = new Date(),
  ) {
    const request = intakeKitchenTicketSchema.parse(input);
    // The workspace must still have the kitchen, and the outlet must be open.
    const [entitlement, outlet] = await Promise.all([
      this.entitlements.describeAccess(source.tenantId, MODULES.kds, now),
      this.sources.findOutlet(source.tenantId, source.outletId),
    ]);
    // Every request of a source counts, whatever happens to it next.
    await this.rateLimit.consume(
      `kds-intake:${source.id}`,
      entitlement.capabilities.has(INTAKE_PRO_CAPABILITY)
        ? INTAKE_RATE_LIMITS.pro
        : INTAKE_RATE_LIMITS.basic,
    );
    assertAccess(
      evaluateAccess(
        {
          allLocations: false,
          capabilities: entitlement.capabilities,
          ...(entitlement.installation ? { installation: entitlement.installation } : {}),
          location: { active: outlet?.status === "ACTIVE", inScope: true },
          membershipActive: true,
          ...(entitlement.module ? { module: entitlement.module } : {}),
          permissionKeys: [],
          subscriptionUsable: entitlement.subscriptionUsable,
        },
        { capability: INTAKE_CAPABILITY, moduleKey: MODULES.kds },
      ),
    );

    const { created, ticket } = await this.createTicket.execute(
      source.tenantId,
      source.outletId,
      {
        items: request.items,
        orderLabel: request.orderLabel,
        source: "API",
        // Two sources may use the same reference; their tickets stay apart.
        sourceReference: `${source.keyPrefix}:${request.reference}`,
        ...(request.tableLabel ? { tableLabel: request.tableLabel } : {}),
      },
      { ...origin, channel: "API" },
    );
    await this.sources.touch(source.id, now);
    return intakeKitchenTicketResultSchema.parse({ created, ticket });
  }
}
