import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import {
  eventOrigin,
  type ActorCommandOrigin,
  type CommandOrigin,
} from "../../shared/command/command-origin.js";
import { safeEventPayload } from "../../shared/command/event-payload.js";
import { buildAuditMetadata, buildAuditPayload } from "../audit/public.js";
import type { LimitThreshold, UsagePeriod } from "./usage-dimensions.js";

export type NewUsageEvent = {
  dimensionKey: string;
  idempotencyKey: string;
  occurredAt: Date;
  quantity: bigint;
  sourceReference?: string;
  sourceType: string;
};

export type UsageRecordOutcome = {
  /** Thresholds this event crossed for the first time in the period. */
  crossed: LimitThreshold[];
  /** False when the same idempotency key was counted before. */
  recorded: boolean;
  used: bigint;
};

export type UsageCounterRecord = {
  dimensionKey: string;
  periodEnd: Date;
  periodStart: Date;
  quantity: bigint;
};

export type NewUsageAdjustment = {
  delta: bigint;
  dimensionKey: string;
  reason: string;
};

export interface MeteringRepository {
  /** Adds a correction to the period's counter; the total never goes below zero. */
  adjust(
    tenantId: string,
    adjustment: NewUsageAdjustment,
    period: UsagePeriod,
    context: ActorCommandOrigin,
  ): Promise<bigint>;
  counters(tenantId: string, moment: Date): Promise<UsageCounterRecord[]>;
  listDimensionKeys(): Promise<string[]>;
  /** Recomputes a period's counter from its events and adjustments. */
  rebuildCounter(tenantId: string, dimensionKey: string, period: UsagePeriod): Promise<bigint>;
  /**
   * Stores the event and raises the counter in one transaction. `thresholds`
   * says at which usage each threshold is reached; one that is reached for
   * the first time in the period is announced.
   */
  record(
    tenantId: string,
    event: NewUsageEvent,
    period: UsagePeriod,
    thresholds: ReadonlyArray<{ at: bigint; threshold: LimitThreshold }>,
    context?: CommandOrigin,
  ): Promise<UsageRecordOutcome>;
}

export const METERING_REPOSITORY = Symbol("METERING_REPOSITORY");

@Injectable()
export class PrismaMeteringRepository implements MeteringRepository {
  async listDimensionKeys() {
    const rows = await getPrismaClient().coreUsageDimension.findMany({ select: { key: true } });
    return rows.map((row) => row.key);
  }

  async counters(tenantId: string, moment: Date) {
    return getPrismaClient().coreUsageCounter.findMany({
      select: { dimensionKey: true, periodEnd: true, periodStart: true, quantity: true },
      where: { periodEnd: { gt: moment }, periodStart: { lte: moment }, tenantId },
    });
  }

  async record(
    tenantId: string,
    event: NewUsageEvent,
    period: UsagePeriod,
    thresholds: ReadonlyArray<{ at: bigint; threshold: LimitThreshold }>,
    context?: CommandOrigin,
  ): Promise<UsageRecordOutcome> {
    return getPrismaClient().$transaction(async (transaction) => {
      const key = {
        tenantId_dimensionKey_periodStart: {
          dimensionKey: event.dimensionKey,
          periodStart: period.start,
          tenantId,
        },
      };
      const created = await transaction.coreUsageEvent.createMany({
        data: [
          {
            dimensionKey: event.dimensionKey,
            idempotencyKey: event.idempotencyKey,
            occurredAt: event.occurredAt,
            quantity: event.quantity,
            ...(event.sourceReference ? { sourceReference: event.sourceReference } : {}),
            sourceType: event.sourceType,
            tenantId,
          },
        ],
        skipDuplicates: true,
      });
      if (created.count === 0) {
        const current = await transaction.coreUsageCounter.findUnique({
          select: { quantity: true },
          where: key,
        });
        return { crossed: [], recorded: false, used: current?.quantity ?? 0n };
      }

      const counter = await transaction.coreUsageCounter.upsert({
        create: {
          dimensionKey: event.dimensionKey,
          periodEnd: period.end,
          periodStart: period.start,
          quantity: event.quantity,
          tenantId,
        },
        select: { quantity: true },
        update: { calculatedAt: new Date(), quantity: { increment: event.quantity } },
        where: key,
      });

      const crossed: LimitThreshold[] = [];
      for (const { at, threshold } of thresholds) {
        if (counter.quantity < at) continue;
        const noted = await transaction.coreLimitNotification.createMany({
          data: [
            { dimensionKey: event.dimensionKey, periodStart: period.start, tenantId, threshold },
          ],
          skipDuplicates: true,
        });
        if (noted.count === 0) continue;
        crossed.push(threshold);
        await transaction.outboxEvent.create({
          data: {
            ...eventOrigin(context, "CORE_SUBSCRIPTION"),
            aggregateId: tenantId,
            aggregateType: "usage_counter",
            payload: safeEventPayload({
              dimensionKey: event.dimensionKey,
              periodEnd: period.end,
              periodStart: period.start,
              threshold,
              used: counter.quantity,
            }),
            tenantId,
            type: "usage.threshold_reached.v1",
          },
        });
      }
      return { crossed, recorded: true, used: counter.quantity };
    });
  }

  async adjust(
    tenantId: string,
    adjustment: NewUsageAdjustment,
    period: UsagePeriod,
    context: ActorCommandOrigin,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const key = {
        tenantId_dimensionKey_periodStart: {
          dimensionKey: adjustment.dimensionKey,
          periodStart: period.start,
          tenantId,
        },
      };
      const before = await transaction.coreUsageCounter.findUnique({
        select: { quantity: true },
        where: key,
      });
      const created = await transaction.coreUsageAdjustment.create({
        data: {
          actorId: context.actorId,
          delta: adjustment.delta,
          dimensionKey: adjustment.dimensionKey,
          periodStart: period.start,
          reason: adjustment.reason,
          tenantId,
        },
        select: { id: true },
      });
      const sum = (before?.quantity ?? 0n) + adjustment.delta;
      const quantity = sum < 0n ? 0n : sum;
      await transaction.coreUsageCounter.upsert({
        create: {
          dimensionKey: adjustment.dimensionKey,
          periodEnd: period.end,
          periodStart: period.start,
          quantity,
          tenantId,
        },
        update: { calculatedAt: new Date(), quantity },
        where: key,
      });
      const payload = buildAuditPayload({
        after: { quantity: quantity.toString() },
        before: { quantity: (before?.quantity ?? 0n).toString() },
        delta: adjustment.delta.toString(),
        dimensionKey: adjustment.dimensionKey,
        periodStart: period.start,
      });
      await transaction.auditLog.create({
        data: {
          action: "usage.adjust",
          actorId: context.actorId,
          entityId: created.id,
          entityType: "usage_adjustment",
          metadata: buildAuditMetadata("usage.adjust", payload),
          reason: adjustment.reason,
          ...(context.requestId ? { requestId: context.requestId } : {}),
          tenantId,
        },
      });
      return quantity;
    });
  }

  async rebuildCounter(tenantId: string, dimensionKey: string, period: UsagePeriod) {
    return getPrismaClient().$transaction(async (transaction) => {
      const [events, adjustments] = await Promise.all([
        transaction.coreUsageEvent.aggregate({
          _sum: { quantity: true },
          where: { dimensionKey, occurredAt: { gte: period.start, lt: period.end }, tenantId },
        }),
        transaction.coreUsageAdjustment.aggregate({
          _sum: { delta: true },
          where: { dimensionKey, periodStart: period.start, tenantId },
        }),
      ]);
      const sum = (events._sum.quantity ?? 0n) + (adjustments._sum.delta ?? 0n);
      const quantity = sum < 0n ? 0n : sum;
      await transaction.coreUsageCounter.upsert({
        create: {
          dimensionKey,
          periodEnd: period.end,
          periodStart: period.start,
          quantity,
          tenantId,
        },
        update: { calculatedAt: new Date(), quantity },
        where: {
          tenantId_dimensionKey_periodStart: { dimensionKey, periodStart: period.start, tenantId },
        },
      });
      return quantity;
    });
  }
}
