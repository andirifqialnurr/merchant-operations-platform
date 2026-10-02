import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { ConflictException, NotFoundException } from "@nestjs/common";

import { cashVariance, decideClose, totalCash } from "../domain/register-session.js";
import type {
  CloseFacts,
  RegisterSessionRecord,
  RegisterSessionRepository,
  ShiftMutationContext,
} from "./register-session.repository.js";
import { ShiftService } from "./shift.service.js";

const TENANT_A = "019f738d-e61f-7d46-92de-17b35f972101";
const TENANT_B = "019f738d-e61f-7d46-92de-17b35f972102";
const OUTLET_A = "019f738d-e61f-7d46-92de-17b35f972103";
const OUTLET_A2 = "019f738d-e61f-7d46-92de-17b35f972104";
const CASHIER = "019f738d-e61f-7d46-92de-17b35f972105";
const OTHER_CASHIER = "019f738d-e61f-7d46-92de-17b35f972106";

class InMemoryRegisterSessionRepository implements RegisterSessionRepository {
  readonly sessions = new Map<string, RegisterSessionRecord>();
  readonly events: string[] = [];

  private clone(session: RegisterSessionRecord): RegisterSessionRecord {
    return { ...session, movements: session.movements.map((movement) => ({ ...movement })) };
  }

  async findById(tenantId: string, sessionId: string) {
    const session = this.sessions.get(sessionId);
    return session && session.tenantId === tenantId ? this.clone(session) : null;
  }

  async findOpen(tenantId: string, outletId: string, cashierId: string) {
    for (const session of this.sessions.values()) {
      if (
        session.tenantId === tenantId &&
        session.outletId === outletId &&
        session.openedBy === cashierId &&
        session.status === "OPEN"
      ) {
        return this.clone(session);
      }
    }
    return null;
  }

  async open(
    tenantId: string,
    outletId: string,
    openingCashMinor: bigint,
    context: ShiftMutationContext,
  ) {
    if (await this.findOpen(tenantId, outletId, context.actorId)) return null;
    const session: RegisterSessionRecord = {
      closedAt: null,
      countedCashMinor: null,
      expectedCashMinor: null,
      id: randomUUID(),
      movements: [],
      openedAt: new Date(),
      openedBy: context.actorId,
      openedByName: "Kasir Uji",
      openingCashMinor,
      outletId,
      status: "OPEN",
      tenantId,
      varianceMinor: null,
      varianceReason: null,
    };
    this.sessions.set(session.id, session);
    this.events.push("shift.opened.v1");
    return this.clone(session);
  }

  async appendCashMovement(
    session: RegisterSessionRecord,
    movement: {
      amountMinor: bigint;
      direction: "IN" | "OUT";
      idempotencyKey: string;
      reason: string;
    },
  ) {
    const stored = this.sessions.get(session.id)!;
    stored.movements.push({ ...movement, createdAt: new Date(), id: randomUUID() });
    return this.clone(stored);
  }

  async close(session: RegisterSessionRecord, facts: CloseFacts) {
    const stored = this.sessions.get(session.id)!;
    Object.assign(stored, facts, { closedAt: new Date(), status: "CLOSED" });
    this.events.push("shift.closed.v1");
    return this.clone(stored);
  }
}

function setup() {
  const repository = new InMemoryRegisterSessionRepository();
  return { repository, service: new ShiftService(repository) };
}

const asCashier: ShiftMutationContext = { actorId: CASHIER };
const asOtherCashier: ShiftMutationContext = { actorId: OTHER_CASHIER };

async function rejectsWithCode(
  promise: Promise<unknown>,
  exception: typeof ConflictException | typeof NotFoundException,
  code: string,
) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof exception);
    assert.equal((error.getResponse() as { code: string }).code, code);
    return true;
  });
}

test("derives expected cash and variance from integer minor units", () => {
  const totals = totalCash(
    100_000n,
    [
      { amountMinor: 50_000n, direction: "IN" },
      { amountMinor: 20_000n, direction: "OUT" },
    ],
    30_000n,
  );
  assert.deepEqual(totals, {
    cashInMinor: 50_000n,
    cashOutMinor: 20_000n,
    expectedCashMinor: 160_000n,
  });
  assert.equal(cashVariance(150_000n, 160_000n), -10_000n);
  assert.deepEqual(decideClose(160_000n, 160_000n, undefined), { ok: true, varianceMinor: 0n });
  assert.deepEqual(decideClose(150_000n, 160_000n, "  "), {
    ok: false,
    reason: "VARIANCE_REASON_REQUIRED",
  });
  assert.deepEqual(decideClose(150_000n, 160_000n, "Salah kembalian"), {
    ok: true,
    varianceMinor: -10_000n,
  });
});

test("opens one shift per cashier per outlet and reports it as current", async () => {
  const { repository, service } = setup();
  assert.deepEqual(await service.getCurrent(TENANT_A, OUTLET_A, CASHIER), { session: null });

  const opened = await service.open(TENANT_A, OUTLET_A, { openingCashMinor: "100000" }, asCashier);
  assert.equal(opened.status, "OPEN");
  assert.equal(opened.openingCashMinor, "100000");
  assert.equal(opened.expectedCashMinor, "100000");
  assert.equal(opened.countedCashMinor, null);
  assert.deepEqual(repository.events, ["shift.opened.v1"]);

  const current = await service.getCurrent(TENANT_A, OUTLET_A, CASHIER);
  assert.equal(current.session?.id, opened.id);

  await rejectsWithCode(
    service.open(TENANT_A, OUTLET_A, { openingCashMinor: "0" }, asCashier),
    ConflictException,
    "POS_SHIFT_ALREADY_OPEN",
  );
  // Another cashier, and the same cashier at another outlet, are independent.
  await service.open(TENANT_A, OUTLET_A, { openingCashMinor: "0" }, asOtherCashier);
  await service.open(TENANT_A, OUTLET_A2, { openingCashMinor: "0" }, asCashier);
});

test("records cash movements idempotently and keeps the drawer non-negative", async () => {
  const { service } = setup();
  const shift = await service.open(TENANT_A, OUTLET_A, { openingCashMinor: "100000" }, asCashier);
  const cashIn = { amountMinor: "50000", direction: "IN", reason: "Tambah modal" } as const;

  const first = await service.recordCashMovement(
    TENANT_A,
    OUTLET_A,
    shift.id,
    cashIn,
    "key-1",
    asCashier,
  );
  assert.equal(first.cashInMinor, "50000");
  assert.equal(first.expectedCashMinor, "150000");

  const replay = await service.recordCashMovement(
    TENANT_A,
    OUTLET_A,
    shift.id,
    cashIn,
    "key-1",
    asCashier,
  );
  assert.equal(replay.movements.length, 1);
  assert.equal(replay.expectedCashMinor, "150000");

  await rejectsWithCode(
    service.recordCashMovement(
      TENANT_A,
      OUTLET_A,
      shift.id,
      { ...cashIn, amountMinor: "70000" },
      "key-1",
      asCashier,
    ),
    ConflictException,
    "IDEMPOTENCY_KEY_REUSED",
  );
  await rejectsWithCode(
    service.recordCashMovement(
      TENANT_A,
      OUTLET_A,
      shift.id,
      { amountMinor: "150001", direction: "OUT", reason: "Setor ke bank" },
      "key-2",
      asCashier,
    ),
    ConflictException,
    "POS_CASH_OUT_EXCEEDS_DRAWER",
  );

  const out = await service.recordCashMovement(
    TENANT_A,
    OUTLET_A,
    shift.id,
    { amountMinor: "20000", direction: "OUT", reason: "Beli es batu" },
    "key-3",
    asCashier,
  );
  assert.equal(out.cashOutMinor, "20000");
  assert.equal(out.expectedCashMinor, "130000");
});

test("closes a balanced shift and requires a reason for a variance", async () => {
  const { repository, service } = setup();
  const shift = await service.open(TENANT_A, OUTLET_A, { openingCashMinor: "100000" }, asCashier);

  await rejectsWithCode(
    service.close(TENANT_A, OUTLET_A, shift.id, { countedCashMinor: "90000" }, asCashier),
    ConflictException,
    "POS_SHIFT_VARIANCE_REASON_REQUIRED",
  );

  const closed = await service.close(
    TENANT_A,
    OUTLET_A,
    shift.id,
    { countedCashMinor: "90000", varianceReason: "Salah kembalian" },
    asCashier,
  );
  assert.equal(closed.status, "CLOSED");
  assert.equal(closed.expectedCashMinor, "100000");
  assert.equal(closed.countedCashMinor, "90000");
  assert.equal(closed.varianceMinor, "-10000");
  assert.equal(closed.varianceReason, "Salah kembalian");
  assert.deepEqual(repository.events, ["shift.opened.v1", "shift.closed.v1"]);

  // A retried close returns the stored result and emits nothing new.
  const retried = await service.close(
    TENANT_A,
    OUTLET_A,
    shift.id,
    { countedCashMinor: "100000" },
    asCashier,
  );
  assert.equal(retried.varianceMinor, "-10000");
  assert.deepEqual(repository.events, ["shift.opened.v1", "shift.closed.v1"]);

  await rejectsWithCode(
    service.recordCashMovement(
      TENANT_A,
      OUTLET_A,
      shift.id,
      { amountMinor: "1000", direction: "IN", reason: "Tambah modal" },
      "key-9",
      asCashier,
    ),
    ConflictException,
    "POS_SHIFT_NOT_OPEN",
  );
  assert.deepEqual(await service.getCurrent(TENANT_A, OUTLET_A, CASHIER), { session: null });
});

test("drops the variance reason when the drawer balances", async () => {
  const { service } = setup();
  const shift = await service.open(TENANT_A, OUTLET_A, { openingCashMinor: "100000" }, asCashier);
  const closed = await service.close(
    TENANT_A,
    OUTLET_A,
    shift.id,
    { countedCashMinor: "100000", varianceReason: "Tidak perlu" },
    asCashier,
  );
  assert.equal(closed.varianceMinor, "0");
  assert.equal(closed.varianceReason, null);
});

test("hides shifts of another tenant, outlet, or cashier", async () => {
  const { service } = setup();
  const shift = await service.open(TENANT_A, OUTLET_A, { openingCashMinor: "100000" }, asCashier);
  const close = { countedCashMinor: "100000" };

  await rejectsWithCode(
    service.close(TENANT_B, OUTLET_A, shift.id, close, asCashier),
    NotFoundException,
    "POS_SHIFT_NOT_FOUND",
  );
  await rejectsWithCode(
    service.close(TENANT_A, OUTLET_A2, shift.id, close, asCashier),
    NotFoundException,
    "POS_SHIFT_NOT_FOUND",
  );
  await rejectsWithCode(
    service.close(TENANT_A, OUTLET_A, shift.id, close, asOtherCashier),
    NotFoundException,
    "POS_SHIFT_NOT_FOUND",
  );
  assert.equal((await service.getCurrent(TENANT_A, OUTLET_A, CASHIER)).session?.id, shift.id);
});
