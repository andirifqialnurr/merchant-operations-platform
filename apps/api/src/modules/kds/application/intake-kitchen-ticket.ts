import {
  intakeKitchenTicketResultSchema,
  intakeKitchenTicketSchema,
  MODULES,
  type IntakeKitchenTicket as IntakeRequest,
} from "@merchant/contracts";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import {
  assertAccess,
  EntitlementService,
  evaluateAccess,
} from "../../../core/entitlements/public.js";
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
  ) {}

  /** The active source behind an `Authorization` header, or a refusal. */
  async authenticate(authorization: string | undefined): Promise<IntakeSourceRecord> {
    const key = readIntakeKey(authorization);
    if (!key) throw invalidKey();
    const source = await this.sources.findActiveByPrefix(key.prefix);
    if (!source || !secretMatches(key.secret, source.secretHash)) throw invalidKey();
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
