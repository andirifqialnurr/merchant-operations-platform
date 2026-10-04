import { usageSummarySchema, type UsageMeter } from "@merchant/contracts";
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from "@nestjs/common";

import type { ActorCommandOrigin, CommandOrigin } from "../../shared/command/command-origin.js";
import {
  USAGE_GAUGE_REGISTRY,
  type LimitGate,
  type UsageGaugeRegistry,
} from "../../shared/limits/limit-gate.js";
import { accessDenied, EntitlementService } from "../entitlements/public.js";
import {
  METERING_REPOSITORY,
  type MeteringRepository,
  type NewUsageAdjustment,
  type NewUsageEvent,
} from "./metering.repository.js";
import {
  isCycleDimension,
  LIMIT_THRESHOLDS,
  thresholdQuantity,
  USAGE_DIMENSIONS,
  usageDimension,
  usagePeriod,
  usageState,
  type UsageDimension,
} from "./usage-dimensions.js";

function knownDimension(key: string): UsageDimension {
  const dimension = usageDimension(key);
  if (!dimension) throw new Error(`Unknown usage dimension ${key}.`);
  return dimension;
}

function cycleDimension(key: string): UsageDimension {
  const dimension = knownDimension(key);
  if (!isCycleDimension(dimension)) {
    throw new Error(`${key} is a count of what exists; it is not metered from events.`);
  }
  return dimension;
}

/** What a workspace uses against what its package allows (prd.md 7.1). */
@Injectable()
export class MeteringService implements LimitGate, OnApplicationBootstrap {
  constructor(
    @Inject(METERING_REPOSITORY) private readonly repository: MeteringRepository,
    @Inject(EntitlementService) private readonly entitlements: EntitlementService,
    @Inject(USAGE_GAUGE_REGISTRY) private readonly gauges: UsageGaugeRegistry,
  ) {}

  /** A gauge for something that is not a hard count is a mistake in the code. */
  onApplicationBootstrap() {
    for (const key of this.gauges.keys()) {
      if (isCycleDimension(knownDimension(key))) {
        throw new Error(`${key} is metered from events; it has no gauge.`);
      }
    }
  }

  /**
   * The gate for hard counts: refuses to add when the package's limit is
   * full. No limit, an unlimited one, or a count nobody reports yet lets it
   * through; what already exists is never touched.
   */
  async assertCanAdd(tenantId: string, dimensionKey: string, adding = 1n, now = new Date()) {
    const dimension = knownDimension(dimensionKey);
    if (dimension.enforcement !== "HARD_COUNT") {
      throw new Error(`${dimensionKey} is not a hard count.`);
    }
    const { limit } = await this.limitOf(tenantId, dimensionKey, now);
    if (!limit || limit.unlimited || limit.value === null) return;
    const gauge = this.gauges.get(dimensionKey);
    if (!gauge) return;
    const used = await gauge(tenantId);
    if (used + adding > limit.value) {
      throw accessDenied("LIMIT_REACHED", {
        dimensionKey,
        limit: limit.value.toString(),
        usage: used.toString(),
      });
    }
  }

  /**
   * For throttled dimensions (exports, external API): counts the use when
   * the cycle's quota has room and refuses with `RATE_LIMITED` when it is
   * full. Nothing is lost by refusing: the caller can try again next cycle.
   */
  async consumeThrottled(tenantId: string, event: NewUsageEvent, context?: CommandOrigin) {
    const dimension = knownDimension(event.dimensionKey);
    if (dimension.enforcement !== "THROTTLED") {
      throw new Error(`${event.dimensionKey} is not throttled.`);
    }
    const { cycle, limit } = await this.limitOf(tenantId, event.dimensionKey, event.occurredAt);
    if (limit && !limit.unlimited && limit.value !== null) {
      const period = usagePeriod(event.occurredAt, cycle);
      const counter = (await this.repository.counters(tenantId, event.occurredAt)).find(
        (item) =>
          item.dimensionKey === event.dimensionKey &&
          item.periodStart.getTime() === period.start.getTime(),
      );
      const used = counter?.quantity ?? 0n;
      if (used + event.quantity > limit.value) {
        throw new HttpException(
          {
            code: "RATE_LIMITED",
            details: {
              dimensionKey: event.dimensionKey,
              limit: limit.value.toString(),
              retryAfter: period.end.toISOString(),
              usage: used.toString(),
            },
            message: "The quota for this period is used up.",
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    return this.record(tenantId, event, context);
  }

  private async limitOf(tenantId: string, dimensionKey: string, now: Date) {
    const { cycle, limits } = await this.entitlements.limitsInForce(tenantId, now);
    return { cycle, limit: limits.find((item) => item.dimensionKey === dimensionKey) };
  }

  /**
   * Counts something that was used. Safe to call again with the same
   * idempotency key: it is counted once. Never refuses: a soft limit lets the
   * work go on and only marks the workspace as over quota.
   */
  async record(tenantId: string, event: NewUsageEvent, context?: CommandOrigin) {
    cycleDimension(event.dimensionKey);
    if (event.quantity <= 0n) throw new Error("A usage quantity must be positive.");
    const { cycle, limit } = await this.limitOf(tenantId, event.dimensionKey, event.occurredAt);
    const value = limit && !limit.unlimited ? limit.value : null;
    const thresholds =
      value === null || value <= 0n
        ? []
        : LIMIT_THRESHOLDS.map((threshold) => ({
            at: thresholdQuantity(value, threshold),
            threshold,
          }));
    return this.repository.record(
      tenantId,
      event,
      usagePeriod(event.occurredAt, cycle),
      thresholds,
      context,
    );
  }

  /** A correction by a person, with a reason, applied to the current period. */
  async adjust(
    tenantId: string,
    adjustment: NewUsageAdjustment,
    context: ActorCommandOrigin,
    now = new Date(),
  ) {
    cycleDimension(adjustment.dimensionKey);
    const reason = adjustment.reason.trim();
    if (adjustment.delta === 0n || reason.length < 3) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "A usage adjustment needs a non-zero amount and a reason.",
      });
    }
    const { cycle } = await this.limitOf(tenantId, adjustment.dimensionKey, now);
    return this.repository.adjust(
      tenantId,
      { ...adjustment, reason },
      usagePeriod(now, cycle),
      context,
    );
  }

  /** Recomputes the current period's counter from its events and adjustments. */
  async rebuild(tenantId: string, dimensionKey: string, now = new Date()) {
    cycleDimension(dimensionKey);
    const { cycle } = await this.limitOf(tenantId, dimensionKey, now);
    return this.repository.rebuildCounter(tenantId, dimensionKey, usagePeriod(now, cycle));
  }

  /**
   * Usage against the limit for every dimension the package limits. A
   * dimension whose usage cannot be counted yet is left out rather than
   * shown as zero.
   */
  async usage(tenantId: string, now = new Date()): Promise<UsageMeter[]> {
    const [{ cycle, limits }, counters] = await Promise.all([
      this.entitlements.limitsInForce(tenantId, now),
      this.repository.counters(tenantId, now),
    ]);
    const period = usagePeriod(now, cycle);
    const meters: UsageMeter[] = [];
    for (const dimension of USAGE_DIMENSIONS) {
      const limit = limits.find((item) => item.dimensionKey === dimension.key);
      if (!limit) continue;
      const cycleBased = isCycleDimension(dimension);
      let used: bigint;
      if (cycleBased) {
        const counter = counters.find(
          (item) =>
            item.dimensionKey === dimension.key &&
            item.periodStart.getTime() === period.start.getTime(),
        );
        used = counter?.quantity ?? 0n;
      } else {
        const gauge = this.gauges.get(dimension.key);
        if (!gauge) continue;
        used = await gauge(tenantId);
      }
      const value = limit.unlimited ? null : limit.value;
      meters.push({
        dimensionKey: dimension.key,
        enforcement: dimension.enforcement,
        limit: value?.toString() ?? null,
        periodEnd: cycleBased ? period.end.toISOString() : null,
        periodStart: cycleBased ? period.start.toISOString() : null,
        state: usageState(used, value),
        unit: dimension.unit,
        unlimited: limit.unlimited,
        used: used.toString(),
      });
    }
    return usageSummarySchema.parse({ meters }).meters;
  }
}
