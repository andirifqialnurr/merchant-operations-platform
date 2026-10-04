import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BadRequestException, HttpException } from "@nestjs/common";

import type { ActorCommandOrigin } from "../../shared/command/command-origin.js";
import type { EntitlementService } from "../entitlements/public.js";
import type {
  MeteringRepository,
  NewUsageAdjustment,
  NewUsageEvent,
  UsageCounterRecord,
} from "./metering.repository.js";
import { UsageGaugeRegistry } from "../../shared/limits/limit-gate.js";
import { MeteringService } from "./metering.service.js";
import {
  thresholdQuantity,
  USAGE_DIMENSIONS,
  usagePeriod,
  usageState,
  type LimitThreshold,
  type UsagePeriod,
} from "./usage-dimensions.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f976001";
const ACTOR: ActorCommandOrigin = { actorId: "019f738d-e61f-7d46-92de-17b35f976002" };
const NOW = new Date("2026-10-15T08:00:00.000Z");
const SALES = "pos.sales.completed.cycle";
const PRODUCTS = "catalog.products.active";

class MemoryMeteringRepository implements MeteringRepository {
  readonly adjustments: Array<NewUsageAdjustment & { periodStart: Date }> = [];
  readonly events: Array<NewUsageEvent & { tenantId: string }> = [];
  readonly notified: string[] = [];
  readonly rows: UsageCounterRecord[] = [];

  private counter(dimensionKey: string, period: UsagePeriod) {
    let row = this.rows.find(
      (item) =>
        item.dimensionKey === dimensionKey && item.periodStart.getTime() === period.start.getTime(),
    );
    if (!row) {
      row = { dimensionKey, periodEnd: period.end, periodStart: period.start, quantity: 0n };
      this.rows.push(row);
    }
    return row;
  }

  async adjust(_tenantId: string, adjustment: NewUsageAdjustment, period: UsagePeriod) {
    this.adjustments.push({ ...adjustment, periodStart: period.start });
    const row = this.counter(adjustment.dimensionKey, period);
    const sum = row.quantity + adjustment.delta;
    row.quantity = sum < 0n ? 0n : sum;
    return row.quantity;
  }

  async counters(_tenantId: string, moment: Date) {
    return this.rows.filter((row) => row.periodStart <= moment && moment < row.periodEnd);
  }

  async listDimensionKeys() {
    return USAGE_DIMENSIONS.map((item) => item.key);
  }

  async rebuildCounter(_tenantId: string, dimensionKey: string, period: UsagePeriod) {
    const row = this.counter(dimensionKey, period);
    const events = this.events
      .filter(
        (item) =>
          item.dimensionKey === dimensionKey &&
          item.occurredAt >= period.start &&
          item.occurredAt < period.end,
      )
      .reduce((sum, item) => sum + item.quantity, 0n);
    const adjusted = this.adjustments
      .filter(
        (item) =>
          item.dimensionKey === dimensionKey &&
          item.periodStart.getTime() === period.start.getTime(),
      )
      .reduce((sum, item) => sum + item.delta, 0n);
    row.quantity = events + adjusted < 0n ? 0n : events + adjusted;
    return row.quantity;
  }

  async record(
    tenantId: string,
    event: NewUsageEvent,
    period: UsagePeriod,
    thresholds: ReadonlyArray<{ at: bigint; threshold: LimitThreshold }>,
  ) {
    const row = this.counter(event.dimensionKey, period);
    const seen = this.events.some(
      (item) =>
        item.dimensionKey === event.dimensionKey && item.idempotencyKey === event.idempotencyKey,
    );
    if (seen) return { crossed: [], recorded: false, used: row.quantity };
    this.events.push({ ...event, tenantId });
    row.quantity += event.quantity;
    const crossed: LimitThreshold[] = [];
    for (const { at, threshold } of thresholds) {
      const key = `${event.dimensionKey}:${period.start.toISOString()}:${threshold}`;
      if (row.quantity >= at && !this.notified.includes(key)) {
        this.notified.push(key);
        crossed.push(threshold);
      }
    }
    return { crossed, recorded: true, used: row.quantity };
  }
}

type Limit = { dimensionKey: string; unlimited: boolean; value: bigint | null };

function setup(
  limits: Limit[] = [{ dimensionKey: SALES, unlimited: false, value: 10n }],
  cycle: { endsAt: Date | null; startsAt: Date } | null = null,
) {
  const repository = new MemoryMeteringRepository();
  const gauges = new UsageGaugeRegistry();
  const entitlements = {
    limitsInForce: async () => ({
      cycle,
      limits: limits.map((item) => ({ ...item, source: "PACKAGE" as const })),
    }),
  } as unknown as EntitlementService;
  return { gauges, repository, service: new MeteringService(repository, entitlements, gauges) };
}

const sale = (index: number, quantity = 1n, occurredAt = NOW): NewUsageEvent => ({
  dimensionKey: SALES,
  idempotencyKey: `sale-0000000000-${index}`,
  occurredAt,
  quantity,
  sourceReference: `sale-${index}`,
  sourceType: "sales_sale",
});

test("the code and the database list the same 25 dimensions", () => {
  const migration = readFileSync(
    new URL(
      "../../../../../packages/database/prisma/migrations/20261004080000_core_metering/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const seeded = [...migration.matchAll(/\('([a-z_.]+)', '([A-Za-z]+)', '([A-Z_]+)'\)/g)].map(
    (match) => ({ enforcement: match[3], key: match[1], unit: match[2] }),
  );
  assert.equal(USAGE_DIMENSIONS.length, 25);
  assert.deepEqual(
    seeded,
    USAGE_DIMENSIONS.map((item) => ({ ...item })),
  );
});

test("a period is the billing cycle when it covers the moment, otherwise the UTC month", () => {
  assert.deepEqual(usagePeriod(NOW), {
    end: new Date("2026-11-01T00:00:00.000Z"),
    start: new Date("2026-10-01T00:00:00.000Z"),
  });
  const cycle = {
    endsAt: new Date("2026-11-10T00:00:00.000Z"),
    startsAt: new Date("2026-10-10T00:00:00.000Z"),
  };
  assert.deepEqual(usagePeriod(NOW, cycle), { end: cycle.endsAt, start: cycle.startsAt });
  // After the cycle ended, or with an open-ended cycle, the month is used.
  assert.equal(
    usagePeriod(new Date("2026-12-05T00:00:00.000Z"), cycle).start.toISOString(),
    "2026-12-01T00:00:00.000Z",
  );
  assert.equal(
    usagePeriod(NOW, { endsAt: null, startsAt: cycle.startsAt }).start.toISOString(),
    "2026-10-01T00:00:00.000Z",
  );
});

test("thresholds round up and the state follows the limit", () => {
  assert.equal(thresholdQuantity(10n, 80), 8n);
  assert.equal(thresholdQuantity(3n, 80), 3n);
  assert.equal(thresholdQuantity(10n, 100), 10n);
  assert.equal(usageState(7n, 10n), "OK");
  assert.equal(usageState(8n, 10n), "NEAR");
  assert.equal(usageState(10n, 10n), "REACHED");
  assert.equal(usageState(11n, 10n), "OVER");
  assert.equal(usageState(1_000_000n, null), "OK");
});

test("the same usage event counts once", async () => {
  const { repository, service } = setup();
  assert.deepEqual(await service.record(TENANT, sale(1)), {
    crossed: [],
    recorded: true,
    used: 1n,
  });
  assert.deepEqual(await service.record(TENANT, sale(1)), {
    crossed: [],
    recorded: false,
    used: 1n,
  });
  assert.equal(repository.events.length, 1);
});

test("a soft limit never refuses and announces each threshold once per period", async () => {
  const { service } = setup();
  const crossed: number[][] = [];
  for (let index = 1; index <= 12; index += 1) {
    crossed.push((await service.record(TENANT, sale(index))).crossed);
  }
  // 80% at the 8th sale, 100% at the 10th, nothing again after that.
  assert.deepEqual(
    crossed
      .map((item, index) => (item.length ? `${index + 1}:${item.join("+")}` : ""))
      .filter(Boolean),
    ["8:80", "10:100"],
  );
  const [meter] = await service.usage(TENANT, NOW);
  assert.deepEqual(
    { limit: meter?.limit, state: meter?.state, used: meter?.used },
    { limit: "10", state: "OVER", used: "12" },
  );
});

test("one large event can cross both thresholds at once", async () => {
  const { service } = setup();
  assert.deepEqual((await service.record(TENANT, sale(1, 15n))).crossed, [80, 100]);
});

test("a new period starts from zero and announces again", async () => {
  const { service } = setup();
  await service.record(TENANT, sale(1, 10n));
  const november = new Date("2026-11-02T08:00:00.000Z");
  const next = await service.record(TENANT, sale(2, 9n, november));
  assert.deepEqual({ crossed: next.crossed, used: next.used }, { crossed: [80], used: 9n });
  assert.equal((await service.usage(TENANT, november))[0]?.used, "9");
  assert.equal((await service.usage(TENANT, NOW))[0]?.used, "10");
});

test("an unlimited or unlisted dimension is counted without thresholds", async () => {
  const unlimited = setup([{ dimensionKey: SALES, unlimited: true, value: null }]);
  assert.deepEqual((await unlimited.service.record(TENANT, sale(1, 500n))).crossed, []);
  const [meter] = await unlimited.service.usage(TENANT, NOW);
  assert.deepEqual(
    { limit: meter?.limit, state: meter?.state, unlimited: meter?.unlimited, used: meter?.used },
    { limit: null, state: "OK", unlimited: true, used: "500" },
  );

  // The package says nothing about sales: still counted, but there is no meter to show.
  const unlisted = setup([]);
  assert.equal((await unlisted.service.record(TENANT, sale(1))).used, 1n);
  assert.deepEqual(await unlisted.service.usage(TENANT, NOW), []);
});

test("an adjustment corrects the period, needs a reason, and never goes below zero", async () => {
  const { repository, service } = setup();
  await service.record(TENANT, sale(1, 5n));
  assert.equal(
    await service.adjust(
      TENANT,
      { delta: -2n, dimensionKey: SALES, reason: "Two test sales" },
      ACTOR,
      NOW,
    ),
    3n,
  );
  assert.equal(
    await service.adjust(
      TENANT,
      { delta: -50n, dimensionKey: SALES, reason: "Reset after import" },
      ACTOR,
      NOW,
    ),
    0n,
  );
  await assert.rejects(
    service.adjust(TENANT, { delta: 1n, dimensionKey: SALES, reason: " " }, ACTOR, NOW),
    BadRequestException,
  );
  await assert.rejects(
    service.adjust(TENANT, { delta: 0n, dimensionKey: SALES, reason: "Nothing" }, ACTOR, NOW),
    BadRequestException,
  );
  assert.equal(repository.adjustments.length, 2);
});

test("the counter can be rebuilt from its events and adjustments", async () => {
  const { repository, service } = setup();
  await service.record(TENANT, sale(1, 4n));
  await service.record(TENANT, sale(2, 3n));
  await service.adjust(
    TENANT,
    { delta: -1n, dimensionKey: SALES, reason: "Duplicate" },
    ACTOR,
    NOW,
  );
  repository.rows[0]!.quantity = 999n;
  assert.equal(await service.rebuild(TENANT, SALES, NOW), 6n);
});

test("a count of what exists comes from its owner, and is left out until the owner reports", async () => {
  const { gauges, service } = setup([
    { dimensionKey: PRODUCTS, unlimited: false, value: 50n },
    { dimensionKey: SALES, unlimited: false, value: 10n },
  ]);
  // No gauge yet: the products meter is not invented as zero.
  assert.deepEqual(
    (await service.usage(TENANT, NOW)).map((item) => item.dimensionKey),
    [SALES],
  );

  gauges.register(PRODUCTS, async () => 40n);
  const meters = await service.usage(TENANT, NOW);
  const products = meters.find((item) => item.dimensionKey === PRODUCTS);
  assert.deepEqual(
    {
      enforcement: products?.enforcement,
      periodStart: products?.periodStart,
      state: products?.state,
      used: products?.used,
    },
    { enforcement: "HARD_COUNT", periodStart: null, state: "NEAR", used: "40" },
  );
});

test("counts and metered dimensions are not mixed up", async () => {
  const { gauges, service } = setup();
  gauges.register(PRODUCTS, async () => 0n);
  assert.throws(() => gauges.register(PRODUCTS, async () => 0n), /registered twice/);
  service.onApplicationBootstrap();
  await assert.rejects(
    service.record(TENANT, { ...sale(1), dimensionKey: PRODUCTS }),
    /count of what exists/,
  );
  await assert.rejects(service.record(TENANT, sale(1, 0n)), /must be positive/);
  await assert.rejects(service.assertCanAdd(TENANT, SALES), /not a hard count/);

  // A gauge for a metered or unknown dimension stops the application from starting.
  const metered = setup();
  metered.gauges.register(SALES, async () => 0n);
  assert.throws(() => metered.service.onApplicationBootstrap(), /metered from events/);
  const unknown = setup();
  unknown.gauges.register("nothing.like.this", async () => 0n);
  assert.throws(() => unknown.service.onApplicationBootstrap(), /Unknown usage/);
});

const codeOf = async (action: () => Promise<unknown>) => {
  try {
    await action();
    return "OK";
  } catch (error) {
    if (error instanceof HttpException) {
      const body = error.getResponse() as { code: string; details?: Record<string, string> };
      return `${error.getStatus()} ${body.code} ${body.details?.usage}/${body.details?.limit}`;
    }
    throw error;
  }
};

test("a hard count refuses the next one when the limit is full, and only then", async () => {
  let products = 48n;
  const { gauges, service } = setup([{ dimensionKey: PRODUCTS, unlimited: false, value: 50n }]);
  gauges.register(PRODUCTS, async () => products);

  assert.equal(await codeOf(() => service.assertCanAdd(TENANT, PRODUCTS)), "OK");
  products = 49n;
  // The 50th still fits.
  assert.equal(await codeOf(() => service.assertCanAdd(TENANT, PRODUCTS)), "OK");
  // Two at once would not.
  assert.equal(
    await codeOf(() => service.assertCanAdd(TENANT, PRODUCTS, 2n)),
    "409 LIMIT_REACHED 49/50",
  );
  products = 50n;
  assert.equal(
    await codeOf(() => service.assertCanAdd(TENANT, PRODUCTS)),
    "409 LIMIT_REACHED 50/50",
  );
  // A downgrade can leave a workspace above its limit: nothing is deleted, adding is refused.
  products = 70n;
  assert.equal(
    await codeOf(() => service.assertCanAdd(TENANT, PRODUCTS)),
    "409 LIMIT_REACHED 70/50",
  );
});

test("no limit, an unlimited one, or an unreported count lets the creation through", async () => {
  const unlisted = setup([]);
  unlisted.gauges.register(PRODUCTS, async () => 1_000n);
  assert.equal(await codeOf(() => unlisted.service.assertCanAdd(TENANT, PRODUCTS)), "OK");

  const unlimited = setup([{ dimensionKey: PRODUCTS, unlimited: true, value: null }]);
  unlimited.gauges.register(PRODUCTS, async () => 1_000n);
  assert.equal(await codeOf(() => unlimited.service.assertCanAdd(TENANT, PRODUCTS)), "OK");

  const unreported = setup([{ dimensionKey: PRODUCTS, unlimited: false, value: 1n }]);
  assert.equal(await codeOf(() => unreported.service.assertCanAdd(TENANT, PRODUCTS)), "OK");
});

test("a throttled dimension counts while there is room and refuses safely after", async () => {
  const EXPORTS = "reports.exports.cycle";
  const { repository, service } = setup([{ dimensionKey: EXPORTS, unlimited: false, value: 2n }]);
  const job = (index: number): NewUsageEvent => ({
    dimensionKey: EXPORTS,
    idempotencyKey: `export-000000000-${index}`,
    occurredAt: NOW,
    quantity: 1n,
    sourceType: "report_export",
  });
  assert.equal(await codeOf(() => service.consumeThrottled(TENANT, job(1))), "OK");
  assert.equal(await codeOf(() => service.consumeThrottled(TENANT, job(2))), "OK");
  assert.equal(
    await codeOf(() => service.consumeThrottled(TENANT, job(3))),
    "429 RATE_LIMITED 2/2",
  );
  // The refused job was not counted.
  assert.equal(repository.events.length, 2);
  await assert.rejects(service.consumeThrottled(TENANT, sale(1)), /not throttled/);
});
