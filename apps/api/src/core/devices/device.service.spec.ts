import assert from "node:assert/strict";
import test from "node:test";

import {
  activateDeviceSchema,
  deviceCredentialSchema,
  type DeviceMode,
  type DeviceStatus,
} from "@merchant/contracts";
import { HttpException } from "@nestjs/common";

import type { ActorCommandOrigin } from "../../shared/command/command-origin.js";
import { UsageGaugeRegistry } from "../../shared/limits/limit-gate.js";
import { InMemoryRateLimitService } from "../security/public.js";
import {
  ACTIVATION_CODE_TTL_MS,
  DEVICE_COOKIE_NAME,
  hashDeviceSecret,
  readDeviceCredential,
  serializeDeviceCookie,
  serializeExpiredDeviceCookie,
} from "./device-credential.js";
import type { DeviceRecord, DeviceRepository, NewDevice } from "./device.repository.js";
import { DeviceService } from "./device.service.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f977001";
const OTHER_TENANT = "019f738d-e61f-7d46-92de-17b35f977002";
const OUTLET = "019f738d-e61f-7d46-92de-17b35f977003";
const CLOSED_OUTLET = "019f738d-e61f-7d46-92de-17b35f977004";
const ACTOR: ActorCommandOrigin = { actorId: "019f738d-e61f-7d46-92de-17b35f977005" };
const NOW = new Date("2026-10-15T08:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

type Row = DeviceRecord & { activationCodeHash: string | null; credentialHash: string | null };

class MemoryDeviceRepository implements DeviceRepository {
  readonly audit: string[] = [];
  readonly rows: Row[] = [];
  touches = 0;

  private record(row: Row): DeviceRecord {
    // Hashes never leave the repository.
    const record: Partial<Row> = { ...row };
    delete record.activationCodeHash;
    delete record.credentialHash;
    return record as DeviceRecord;
  }

  async findOutlet(tenantId: string, outletId: string) {
    if (tenantId !== TENANT) return null;
    if (outletId === OUTLET) return { status: "ACTIVE" };
    return outletId === CLOSED_OUTLET ? { status: "INACTIVE" } : null;
  }

  async list(tenantId: string) {
    return this.rows.filter((row) => row.tenantId === tenantId).map((row) => this.record(row));
  }

  async findById(tenantId: string, id: string) {
    const row = this.rows.find((item) => item.tenantId === tenantId && item.id === id);
    return row ? this.record(row) : null;
  }

  async findByCredential(credentialHash: string) {
    const row = this.rows.find(
      (item) => item.credentialHash === credentialHash && item.status === "ACTIVE",
    );
    return row ? this.record(row) : null;
  }

  async countInUse(tenantId: string, mode: DeviceMode) {
    return this.rows.filter(
      (row) => row.tenantId === tenantId && row.mode === mode && row.status !== "REVOKED",
    ).length;
  }

  async create(tenantId: string, device: NewDevice) {
    const row: Row = {
      activatedAt: null,
      activationCodeHash: device.activationCodeHash,
      activationExpiresAt: device.activationExpiresAt,
      createdAt: NOW,
      credentialHash: null,
      id: `019f738d-e61f-7d46-92de-17b35f97710${this.rows.length}`,
      label: device.label,
      lastSeenAt: null,
      mode: device.mode,
      outletId: device.outletId,
      revokedAt: null,
      status: "PENDING",
      tenantId,
    };
    this.rows.push(row);
    this.audit.push("device.register");
    return this.record(row);
  }

  async reissueCode(tenantId: string, id: string, activationCodeHash: string, expiresAt: Date) {
    const row = this.rows.find((item) => item.tenantId === tenantId && item.id === id);
    if (!row || row.status !== "PENDING") return null;
    Object.assign(row, { activationCodeHash, activationExpiresAt: expiresAt });
    this.audit.push("device.reissue_code");
    return this.record(row);
  }

  async activate(activationCodeHash: string, credentialHash: string, now: Date) {
    const row = this.rows.find(
      (item) =>
        item.activationCodeHash === activationCodeHash &&
        item.status === "PENDING" &&
        item.activationExpiresAt !== null &&
        item.activationExpiresAt > now,
    );
    if (!row) return null;
    Object.assign(row, {
      activatedAt: now,
      activationCodeHash: null,
      activationExpiresAt: null,
      credentialHash,
      lastSeenAt: now,
      status: "ACTIVE" satisfies DeviceStatus,
    });
    this.audit.push("device.activate");
    return this.record(row);
  }

  async revoke(tenantId: string, id: string, now: Date) {
    const row = this.rows.find((item) => item.tenantId === tenantId && item.id === id);
    if (!row || row.status === "REVOKED") return null;
    Object.assign(row, {
      activationCodeHash: null,
      activationExpiresAt: null,
      credentialHash: null,
      revokedAt: now,
      status: "REVOKED" satisfies DeviceStatus,
    });
    this.audit.push("device.revoke");
    return this.record(row);
  }

  async touch(id: string, now: Date) {
    const row = this.rows.find((item) => item.id === id);
    if (row) row.lastSeenAt = now;
    this.touches += 1;
  }
}

function setup(limits?: {
  assertCanAdd: (tenantId: string, dimensionKey: string) => Promise<void>;
}) {
  const repository = new MemoryDeviceRepository();
  const gauges = new UsageGaugeRegistry();
  const service = new DeviceService(repository, new InMemoryRateLimitService(), limits, gauges);
  service.onModuleInit();
  return { gauges, repository, service };
}

const tablet = { label: "Kasir depan", mode: "POS" as const, outletId: OUTLET };

const codeOf = async (action: () => Promise<unknown>) => {
  try {
    await action();
    return "OK";
  } catch (error) {
    if (error instanceof HttpException) {
      return `${error.getStatus()} ${(error.getResponse() as { code: string }).code}`;
    }
    throw error;
  }
};

test("registering a device gives a code once and stores only its hash", async () => {
  const { repository, service } = setup();
  const ticket = await service.register(TENANT, tablet, ACTOR, NOW);

  assert.match(ticket.activationCode, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
  assert.equal(ticket.device.status, "PENDING");
  assert.equal(ticket.device.activationExpiresAt, later(ACTIVATION_CODE_TTL_MS).toISOString());
  // Nothing readable is kept: neither the code nor, later, the credential.
  const stored = JSON.stringify(repository.rows);
  const plain = ticket.activationCode.replace("-", "");
  assert.equal(stored.includes(plain), false);
  assert.equal(repository.rows[0]?.activationCodeHash, hashDeviceSecret(plain));
  // Listing the device later never shows the code again.
  assert.equal(JSON.stringify(await service.list(TENANT)).includes(plain), false);
});

test("a device can only be registered for an active outlet of the same workspace", async () => {
  const { repository, service } = setup();
  assert.equal(
    await codeOf(() => service.register(TENANT, { ...tablet, outletId: CLOSED_OUTLET }, ACTOR)),
    "409 OUTLET_INACTIVE",
  );
  assert.equal(
    await codeOf(() => service.register(OTHER_TENANT, tablet, ACTOR)),
    "404 OUTLET_NOT_FOUND",
  );
  assert.equal(repository.rows.length, 0);
});

test("the code activates the device once and hands it a credential of its own", async () => {
  const { repository, service } = setup();
  const ticket = await service.register(TENANT, tablet, ACTOR, NOW);
  // People type it as they like: lower case, with or without the dash.
  const typed = activateDeviceSchema.parse({ code: ticket.activationCode.toLowerCase() }).code;

  const { credential, device } = await service.activate(typed, {}, undefined, later(60_000));
  assert.equal(device.status, "ACTIVE");
  assert.equal(device.activationExpiresAt, null);
  assert.equal(deviceCredentialSchema.safeParse(credential).success, true);
  assert.equal(repository.rows[0]?.credentialHash, hashDeviceSecret(credential));
  assert.equal(JSON.stringify(repository.rows).includes(credential), false);

  // The same code on a second device does nothing.
  assert.equal(
    await codeOf(() => service.activate(typed, {}, undefined, later(120_000))),
    "400 DEVICE_ACTIVATION_INVALID",
  );
  assert.equal((await service.authenticate(credential, later(120_000)))?.id, device.id);
});

test("a wrong code and an expired code get the same answer", async () => {
  const { service } = setup();
  const ticket = await service.register(TENANT, tablet, ACTOR, NOW);
  const code = ticket.activationCode.replace("-", "");

  assert.equal(
    await codeOf(() => service.activate("22222222", {}, undefined, later(1_000))),
    "400 DEVICE_ACTIVATION_INVALID",
  );
  assert.equal(
    await codeOf(() => service.activate(code, {}, undefined, later(ACTIVATION_CODE_TTL_MS))),
    "400 DEVICE_ACTIVATION_INVALID",
  );
});

test("guessing codes is held back per network address", async () => {
  const { service } = setup();
  const attempt = (ipAddress: string) =>
    codeOf(() => service.activate("22222222", { ipAddress }, undefined, NOW));

  for (let index = 0; index < 10; index += 1) {
    assert.equal(await attempt("10.0.0.1"), "400 DEVICE_ACTIVATION_INVALID");
  }
  assert.equal(await attempt("10.0.0.1"), "429 RATE_LIMIT_EXCEEDED");
  // Another address is not punished for it.
  assert.equal(await attempt("10.0.0.2"), "400 DEVICE_ACTIVATION_INVALID");
});

test("an expired code can be replaced while the device was never activated", async () => {
  const { repository, service } = setup();
  const first = await service.register(TENANT, tablet, ACTOR, NOW);
  const afterExpiry = later(ACTIVATION_CODE_TTL_MS + 1_000);
  const second = await service.reissueCode(TENANT, first.device.id, ACTOR, afterExpiry);

  assert.notEqual(second.activationCode, first.activationCode);
  // The old code is gone for good.
  assert.equal(
    await codeOf(() =>
      service.activate(first.activationCode.replace("-", ""), {}, undefined, afterExpiry),
    ),
    "400 DEVICE_ACTIVATION_INVALID",
  );
  await service.activate(second.activationCode.replace("-", ""), {}, undefined, afterExpiry);
  assert.equal(
    await codeOf(() => service.reissueCode(TENANT, first.device.id, ACTOR, afterExpiry)),
    "409 DEVICE_NOT_PENDING",
  );
  assert.deepEqual(repository.audit, ["device.register", "device.reissue_code", "device.activate"]);
});

test("revoking a device stops its credential at once and cannot be undone by the code", async () => {
  const { service } = setup();
  const ticket = await service.register(TENANT, tablet, ACTOR, NOW);
  const { credential, device } = await service.activate(
    ticket.activationCode.replace("-", ""),
    {},
    undefined,
    NOW,
  );
  assert.ok(await service.authenticate(credential, NOW));

  const revoked = await service.revoke(TENANT, device.id, ACTOR, later(1_000));
  assert.equal(revoked.status, "REVOKED");
  assert.equal(revoked.revokedAt, later(1_000).toISOString());
  assert.equal(await service.authenticate(credential, later(2_000)), undefined);
  assert.equal(
    await codeOf(() => service.requireDevice(credential, later(2_000))),
    "401 DEVICE_NOT_ACTIVATED",
  );
  assert.equal(
    await codeOf(() => service.revoke(TENANT, device.id, ACTOR)),
    "409 DEVICE_ALREADY_REVOKED",
  );
});

test("a pending device can be revoked, and its code dies with it", async () => {
  const { service } = setup();
  const ticket = await service.register(TENANT, tablet, ACTOR, NOW);
  await service.revoke(TENANT, ticket.device.id, ACTOR, NOW);
  assert.equal(
    await codeOf(() =>
      service.activate(ticket.activationCode.replace("-", ""), {}, undefined, later(1_000)),
    ),
    "400 DEVICE_ACTIVATION_INVALID",
  );
});

test("another workspace cannot see, revoke, or reissue a device", async () => {
  const { service } = setup();
  const ticket = await service.register(TENANT, tablet, ACTOR, NOW);

  assert.deepEqual(await service.list(OTHER_TENANT), []);
  assert.equal(
    await codeOf(() => service.revoke(OTHER_TENANT, ticket.device.id, ACTOR)),
    "404 DEVICE_NOT_FOUND",
  );
  assert.equal(
    await codeOf(() => service.reissueCode(OTHER_TENANT, ticket.device.id, ACTOR)),
    "404 DEVICE_NOT_FOUND",
  );
  assert.equal((await service.list(TENANT))[0]?.status, "PENDING");
});

test("last seen is refreshed at most every five minutes", async () => {
  const { repository, service } = setup();
  const ticket = await service.register(TENANT, tablet, ACTOR, NOW);
  const { credential } = await service.activate(
    ticket.activationCode.replace("-", ""),
    {},
    undefined,
    NOW,
  );

  await service.authenticate(credential, later(60_000));
  await service.authenticate(credential, later(4 * 60_000));
  assert.equal(repository.touches, 0);
  const seen = await service.authenticate(credential, later(5 * 60_000));
  assert.equal(repository.touches, 1);
  assert.equal(seen?.lastSeenAt, later(5 * 60_000).toISOString());
});

test("devices count against their limit from registration until they are revoked", async () => {
  const asked: string[] = [];
  const { gauges, service } = setup({
    assertCanAdd: async (_tenantId, dimensionKey) => {
      asked.push(dimensionKey);
    },
  });
  const pos = await service.register(TENANT, tablet, ACTOR, NOW);
  await service.register(TENANT, { ...tablet, label: "Dapur", mode: "KDS" }, ACTOR, NOW);

  assert.deepEqual(asked, ["pos.registers.active", "kds.devices.active"]);
  assert.equal(await gauges.get("pos.registers.active")?.(TENANT), 1n);
  assert.equal(await gauges.get("kds.devices.active")?.(TENANT), 1n);
  await service.revoke(TENANT, pos.device.id, ACTOR, NOW);
  assert.equal(await gauges.get("pos.registers.active")?.(TENANT), 0n);
});

test("a full device limit refuses the registration and creates nothing", async () => {
  const { repository, service } = setup({
    assertCanAdd: async () => {
      throw new HttpException({ code: "LIMIT_REACHED" }, 409);
    },
  });
  assert.equal(await codeOf(() => service.register(TENANT, tablet, ACTOR)), "409 LIMIT_REACHED");
  assert.equal(repository.rows.length, 0);
});

test("the device cookie is separate from the session cookie and unreadable by scripts", () => {
  const credential = "A".repeat(43);
  const cookie = serializeDeviceCookie(credential, true);
  assert.equal(DEVICE_COOKIE_NAME, "merchant_device");
  for (const attribute of ["HttpOnly", "SameSite=Lax", "Secure", "Path=/"]) {
    assert.ok(cookie.includes(attribute), attribute);
  }
  assert.equal(serializeDeviceCookie(credential, false).includes("Secure"), false);
  assert.ok(serializeExpiredDeviceCookie(false).includes("Max-Age=0"));

  assert.equal(
    readDeviceCredential(`merchant_session=${"B".repeat(43)}; merchant_device=${credential}`),
    credential,
  );
  // A session cookie is never mistaken for a device credential, nor a malformed value accepted.
  assert.equal(readDeviceCredential(`merchant_session=${credential}`), undefined);
  assert.equal(readDeviceCredential("merchant_device=short"), undefined);
  assert.equal(readDeviceCredential(undefined), undefined);
});
