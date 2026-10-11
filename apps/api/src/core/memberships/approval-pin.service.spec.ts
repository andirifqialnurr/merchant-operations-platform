import assert from "node:assert/strict";
import test from "node:test";

import { PERMISSIONS, type PermissionKey } from "@merchant/contracts";

import { verifyPassword } from "../auth/public.js";
import type { AccessService } from "./access.service.js";
import type {
  ApprovalPinAudit,
  ApprovalPinRecord,
  ApprovalPinRepository,
} from "./approval-pin.repository.js";
import {
  APPROVAL_PIN_LOCK_MS,
  APPROVAL_PIN_MAX_ATTEMPTS,
  ApprovalPinService,
} from "./approval-pin.service.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f978001";
const OUTLET = "019f738d-e61f-7d46-92de-17b35f978002";
const OTHER_OUTLET = "019f738d-e61f-7d46-92de-17b35f978003";
const MANAGER = "019f738d-e61f-7d46-92de-17b35f978004";
const CASHIER = "019f738d-e61f-7d46-92de-17b35f978005";

class InMemoryPins implements ApprovalPinRepository {
  readonly rows = new Map<string, ApprovalPinRecord>();
  readonly audits: ApprovalPinAudit["action"][] = [];

  async find(_tenantId: string, userId: string) {
    return this.rows.get(userId) ?? null;
  }
  async list() {
    return [...this.rows.values()];
  }
  async userIdsWithPin() {
    return new Set(this.rows.keys());
  }
  async save(_tenantId: string, userId: string, pinHash: string, audit: ApprovalPinAudit) {
    this.rows.set(userId, {
      displayName: userId === MANAGER ? "Bu Rina" : "Kasir",
      failedAttempts: 0,
      lockedUntil: null,
      pinHash,
      userId,
    });
    this.audits.push(audit.action);
  }
  async delete(_tenantId: string, userId: string, audit: ApprovalPinAudit) {
    if (!this.rows.delete(userId)) return false;
    this.audits.push(audit.action);
    return true;
  }
  async recordFailure(_tenantId: string, userId: string, maxAttempts: number, lockUntil: Date) {
    const row = this.rows.get(userId);
    assert.ok(row);
    if (row.failedAttempts + 1 >= maxAttempts) {
      row.failedAttempts = 0;
      row.lockedUntil = lockUntil;
      this.audits.push("approval_pin.locked");
    } else {
      row.failedAttempts += 1;
    }
    return { failedAttempts: row.failedAttempts, lockedUntil: row.lockedUntil };
  }
  async recordSuccess(_tenantId: string, userId: string) {
    const row = this.rows.get(userId);
    assert.ok(row);
    row.failedAttempts = 0;
    row.lockedUntil = null;
  }
}

/** The manager may refund at one outlet; the cashier may not refund anywhere. */
function setup(managerPermissions: PermissionKey[] = [PERMISSIONS.paymentRefund]) {
  const pins = new InMemoryPins();
  const access = {
    describeAccess: async (userId: string, _tenantId: string, outletId?: string) => ({
      context: {
        allOutlets: false,
        membershipId: userId,
        outletIds: [OUTLET],
        permissionKeys: userId === MANAGER ? managerPermissions : [PERMISSIONS.orderCreate],
        tenantId: TENANT,
        userId,
      },
      location: { active: true, inScope: outletId === OUTLET },
      membershipActive: true,
    }),
  } as unknown as AccessService;
  const service = new ApprovalPinService(pins, access);
  let clock = new Date("2026-10-12T03:00:00.000Z");
  service.now = () => clock;
  const verify = (pin: string, outletId = OUTLET, approverUserId = MANAGER) =>
    service.verify({
      approverUserId,
      outletId,
      permission: PERMISSIONS.paymentRefund,
      pin,
      tenantId: TENANT,
    });
  return {
    advance: (milliseconds: number) => {
      clock = new Date(clock.getTime() + milliseconds);
    },
    pins,
    service,
    verify,
  };
}

const code = (error: unknown) =>
  (error as { getResponse?: () => { code?: string } }).getResponse?.().code;
const details = (error: unknown) =>
  (error as { getResponse: () => { details?: Record<string, string> } }).getResponse().details;

test("a PIN is kept only as a hash and approves at the outlet of the approver", async () => {
  const { pins, service, verify } = setup();
  await service.setOwn(TENANT, MANAGER, "482913");

  const stored = pins.rows.get(MANAGER);
  assert.ok(stored);
  assert.equal(stored.pinHash.includes("482913"), false);
  assert.equal(await verifyPassword("482913", stored.pinHash), true);
  assert.deepEqual(pins.audits, ["approval_pin.set"]);

  assert.deepEqual(await verify("482913"), { displayName: "Bu Rina", userId: MANAGER });
  // The right PIN is not enough at an outlet the approver is not assigned to.
  await assert.rejects(
    () => verify("482913", OTHER_OUTLET),
    (error) => code(error) === "APPROVAL_PIN_INVALID",
  );
});

test("a PIN somebody would guess first is refused", async () => {
  const { service } = setup();
  for (const pin of ["000000", "111111", "123456", "654321"]) {
    await assert.rejects(
      () => service.setOwn(TENANT, MANAGER, pin),
      (error) => code(error) === "APPROVAL_PIN_TOO_SIMPLE",
    );
  }
  await service.setOwn(TENANT, MANAGER, "135790");
});

test("wrong tries are counted, then the PIN is locked for a while", async () => {
  const { advance, pins, service, verify } = setup();
  await service.setOwn(TENANT, MANAGER, "482913");

  for (let attempt = 1; attempt < APPROVAL_PIN_MAX_ATTEMPTS; attempt += 1) {
    await assert.rejects(
      () => verify("000001"),
      (error) =>
        code(error) === "APPROVAL_PIN_INVALID" &&
        details(error)?.attemptsLeft === String(APPROVAL_PIN_MAX_ATTEMPTS - attempt),
    );
  }
  await assert.rejects(
    () => verify("000001"),
    (error) => code(error) === "APPROVAL_PIN_LOCKED",
  );
  assert.equal(pins.audits.at(-1), "approval_pin.locked");
  // While locked even the right PIN is refused.
  await assert.rejects(
    () => verify("482913"),
    (error) => code(error) === "APPROVAL_PIN_LOCKED",
  );

  advance(APPROVAL_PIN_LOCK_MS + 1);
  assert.equal((await verify("482913")).userId, MANAGER);
  assert.equal(pins.rows.get(MANAGER)?.failedAttempts, 0);
});

test("a right PIN in between starts the count again", async () => {
  const { pins, service, verify } = setup();
  await service.setOwn(TENANT, MANAGER, "482913");
  await assert.rejects(() => verify("000001"));
  await assert.rejects(() => verify("000002"));
  await verify("482913");
  assert.equal(pins.rows.get(MANAGER)?.failedAttempts, 0);
});

test("nobody approves without the permission or without a PIN, and never for themselves", async () => {
  const withoutPermission = setup([PERMISSIONS.orderCreate]);
  await withoutPermission.service.setOwn(TENANT, MANAGER, "482913");
  await assert.rejects(
    () => withoutPermission.verify("482913"),
    (error) => code(error) === "APPROVAL_PIN_INVALID",
  );
  assert.deepEqual(
    await withoutPermission.service.approvers(TENANT, OUTLET, PERMISSIONS.paymentRefund, CASHIER),
    [],
  );

  const { service, verify } = setup();
  // No PIN set: the same answer as a wrong one, so nothing is learned.
  await assert.rejects(
    () => verify("482913"),
    (error) => code(error) === "APPROVAL_PIN_INVALID" && details(error) === undefined,
  );
  await service.setOwn(TENANT, MANAGER, "482913");
  assert.deepEqual(await service.approvers(TENANT, OUTLET, PERMISSIONS.paymentRefund, CASHIER), [
    { displayName: "Bu Rina", userId: MANAGER },
  ]);
  // Not offered at another outlet, and never to themselves.
  assert.deepEqual(
    await service.approvers(TENANT, OTHER_OUTLET, PERMISSIONS.paymentRefund, CASHIER),
    [],
  );
  assert.deepEqual(await service.approvers(TENANT, OUTLET, PERMISSIONS.paymentRefund, MANAGER), []);
});

test("a reset removes the PIN; the member sets a new one", async () => {
  const { pins, service, verify } = setup();
  await service.setOwn(TENANT, MANAGER, "482913");
  await service.reset(TENANT, MANAGER);
  assert.deepEqual(pins.audits, ["approval_pin.set", "approval_pin.reset"]);
  assert.deepEqual(await service.status(TENANT, MANAGER, true), {
    canApprove: true,
    hasPin: false,
  });
  await assert.rejects(() => verify("482913"));
  await assert.rejects(
    () => service.reset(TENANT, MANAGER),
    (error) => code(error) === "APPROVAL_PIN_NOT_SET",
  );
});
