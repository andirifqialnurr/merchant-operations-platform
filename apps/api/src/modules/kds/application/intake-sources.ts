import {
  createKdsIntakeSourceSchema,
  kdsIntakeSourceCreatedSchema,
  kdsIntakeSourceSchema,
  type CreateKdsIntakeSource,
  type KdsIntakeSource,
} from "@merchant/contracts";
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  type OnModuleInit,
} from "@nestjs/common";

import { accessDenied, EntitlementService } from "../../../core/entitlements/public.js";
import type { ActorCommandOrigin } from "../../../shared/command/command-origin.js";
import {
  LIMIT_GATE,
  NO_LIMITS,
  USAGE_GAUGE_REGISTRY,
  type LimitGate,
  type UsageGaugeRegistry,
} from "../../../shared/limits/limit-gate.js";
import { createIntakeKey } from "../domain/intake-key.js";
import {
  INTAKE_SOURCE_REPOSITORY,
  IntakeSourceLimitReached,
  type IntakeSourceRecord,
  type IntakeSourceRepository,
} from "./intake-source.repository.js";

/** Active sources count against the package: KDS Basic allows one. */
export const INTAKE_SOURCES_DIMENSION = "kds.intake_sources.active";

export function toIntakeSource(record: IntakeSourceRecord): KdsIntakeSource {
  return kdsIntakeSourceSchema.parse({
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    keyPrefix: record.keyPrefix,
    label: record.label,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    outletId: record.outletId,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    status: record.status,
  });
}

/**
 * The external systems allowed to send tickets to a workspace's kitchens.
 * A source is made with a key that is shown once, and stops working the
 * moment it is revoked.
 */
@Injectable()
export class IntakeSources implements OnModuleInit {
  constructor(
    @Inject(INTAKE_SOURCE_REPOSITORY) private readonly sources: IntakeSourceRepository,
    @Optional() @Inject(LIMIT_GATE) private readonly limits: LimitGate = NO_LIMITS,
    @Optional() @Inject(USAGE_GAUGE_REGISTRY) private readonly gauges?: UsageGaugeRegistry,
    @Optional() @Inject(EntitlementService) private readonly entitlements?: EntitlementService,
  ) {}

  onModuleInit() {
    this.gauges?.register(INTAKE_SOURCES_DIMENSION, async (tenantId) =>
      BigInt(await this.sources.countActive(tenantId)),
    );
  }

  async list(tenantId: string) {
    return (await this.sources.list(tenantId)).map(toIntakeSource);
  }

  async create(tenantId: string, input: CreateKdsIntakeSource, origin: ActorCommandOrigin) {
    const command = createKdsIntakeSourceSchema.parse(input);
    const outlet = await this.sources.findOutlet(tenantId, command.outletId);
    if (!outlet) {
      throw new NotFoundException({ code: "OUTLET_NOT_FOUND", message: "Outlet was not found." });
    }
    if (outlet.status !== "ACTIVE") {
      throw new ConflictException({ code: "OUTLET_INACTIVE", message: "Outlet is not active." });
    }
    await this.limits.assertCanAdd(tenantId, INTAKE_SOURCES_DIMENSION);
    const effective = await this.entitlements?.limitsInForce(tenantId);
    const limit = effective?.limits.find((item) => item.dimensionKey === INTAKE_SOURCES_DIMENSION);
    const maxActive = limit && !limit.unlimited ? (limit.value ?? undefined) : undefined;
    const { key, prefix, secretHash } = createIntakeKey();
    try {
      const record = await this.sources.create(
        tenantId,
        { keyPrefix: prefix, label: command.label, outletId: command.outletId, secretHash },
        origin,
        maxActive,
      );
      return kdsIntakeSourceCreatedSchema.parse({ key, source: toIntakeSource(record) });
    } catch (error) {
      if (error instanceof IntakeSourceLimitReached) {
        throw accessDenied("LIMIT_REACHED", {
          dimensionKey: INTAKE_SOURCES_DIMENSION,
          limit: error.limit.toString(),
          usage: error.usage.toString(),
        });
      }
      throw error;
    }
  }

  async revoke(tenantId: string, id: string, origin: ActorCommandOrigin, now = new Date()) {
    const revoked = await this.sources.revoke(tenantId, id, now, origin);
    if (!revoked) {
      throw new NotFoundException({
        code: "KDS_INTAKE_SOURCE_NOT_FOUND",
        message: "This intake source was not found or is already revoked.",
      });
    }
    return toIntakeSource(revoked);
  }
}
