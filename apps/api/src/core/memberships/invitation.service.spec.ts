import assert from "node:assert/strict";
import test from "node:test";

import { HttpException } from "@nestjs/common";

import type { ActorCommandOrigin } from "../../shared/command/command-origin.js";
import { verifyPassword } from "../auth/public.js";
import { InMemoryRateLimitService } from "../security/public.js";
import type { AccessRepository, MembershipRecord } from "./access.repository.js";
import {
  createInvitationDelivery,
  invitationAcceptUrl,
  type InvitationDelivery,
  type InvitationMessage,
} from "./invitation-delivery.js";
import type {
  InvitationRecord,
  InvitationRepository,
  InvitedAccount,
  NewInvitation,
} from "./invitation.repository.js";
import { hashInvitationToken, INVITATION_TTL_MS, InvitationService } from "./invitation.service.js";

const TENANT = "019f738d-e61f-7d46-92de-17b35f97a001";
const OTHER_TENANT = "019f738d-e61f-7d46-92de-17b35f97a002";
const ROLE = "019f738d-e61f-7d46-92de-17b35f97a003";
const OLD_ROLE = "019f738d-e61f-7d46-92de-17b35f97a004";
const OUTLET = "019f738d-e61f-7d46-92de-17b35f97a005";
const EXISTING_USER = "019f738d-e61f-7d46-92de-17b35f97a006";
const ACTOR: ActorCommandOrigin = { actorId: "019f738d-e61f-7d46-92de-17b35f97a007" };
const NOW = new Date("2026-10-15T08:00:00.000Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

type Row = InvitationRecord & { tokenHash: string | null };
type User = {
  displayName: string;
  email: string;
  id: string;
  passwordHash: string;
  status: string;
};

class World {
  readonly audit: string[] = [];
  readonly invitations: Row[] = [];
  readonly memberships: Array<{ tenantId: string; userId: string } & Partial<MembershipRecord>> =
    [];
  readonly roles = new Map([
    [ROLE, "ACTIVE"],
    [OLD_ROLE, "ACTIVE"],
  ]);
  readonly users: User[] = [
    {
      displayName: "Sudah Punya Akun",
      email: "lama@example.com",
      id: EXISTING_USER,
      passwordHash: "x",
      status: "ACTIVE",
    },
  ];

  readonly access = {
    findMembershipByUser: async (tenantId: string, userId: string) =>
      this.memberships.find((item) => item.tenantId === tenantId && item.userId === userId) ?? null,
    findOutlets: async (tenantId: string, outletIds: string[]) =>
      tenantId === TENANT
        ? outletIds.filter((id) => id === OUTLET).map((id) => ({ id, status: "ACTIVE" }))
        : [],
    findRoles: async (tenantId: string, roleIds: string[]) =>
      tenantId === TENANT
        ? roleIds
            .filter((id) => this.roles.has(id))
            .map((id) => ({ id, status: this.roles.get(id) }))
        : [],
    findTenant: async (tenantId: string) =>
      tenantId === TENANT ? { id: tenantId, status: "ACTIVE" } : null,
  } as unknown as AccessRepository;

  private record(row: Row): InvitationRecord {
    const record: Partial<Row> = { ...row };
    delete record.tokenHash;
    return record as InvitationRecord;
  }

  readonly repository: InvitationRepository = {
    accept: async (tokenHash: string, account: InvitedAccount | undefined, now: Date) => {
      const row = this.invitations.find(
        (item) => item.tokenHash === tokenHash && item.status === "PENDING" && item.expiresAt > now,
      );
      if (!row) return null;
      Object.assign(row, { acceptedAt: now, status: "ACCEPTED", tokenHash: null });
      let user = this.users.find((item) => item.email === row.email);
      if (!user) {
        assert.ok(account, "a new account needs its details");
        user = {
          displayName: account.displayName,
          email: row.email,
          id: `019f738d-e61f-7d46-92de-17b35f97a1${this.users.length.toString().padStart(2, "0")}`,
          passwordHash: account.passwordHash,
          status: "ACTIVE",
        };
        this.users.push(user);
      }
      const membership = {
        allOutlets: row.allOutlets,
        outletIds: row.outletIds,
        roleIds: row.roleIds,
        tenantId: row.tenantId,
        userId: user.id,
      };
      this.memberships.push(membership);
      this.audit.push("invitation.accept");
      return membership as unknown as MembershipRecord;
    },
    create: async (tenantId: string, invitation: NewInvitation) => {
      const row: Row = {
        acceptedAt: null,
        allOutlets: invitation.allOutlets,
        createdAt: NOW,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        id: `019f738d-e61f-7d46-92de-17b35f97a2${this.invitations.length.toString().padStart(2, "0")}`,
        outletIds: invitation.outletIds,
        revokedAt: null,
        roleIds: invitation.roleIds,
        status: "PENDING",
        tenantId,
        tokenHash: invitation.tokenHash,
      };
      this.invitations.push(row);
      this.audit.push("invitation.create");
      return this.record(row);
    },
    expireStale: async (tenantId: string, email: string, now: Date) => {
      for (const row of this.invitations) {
        if (
          row.tenantId === tenantId &&
          row.email === email &&
          row.status === "PENDING" &&
          row.expiresAt <= now
        ) {
          Object.assign(row, { status: "EXPIRED", tokenHash: null });
        }
      }
    },
    findById: async (tenantId: string, id: string) => {
      const row = this.invitations.find((item) => item.tenantId === tenantId && item.id === id);
      return row ? this.record(row) : null;
    },
    findByToken: async (tokenHash: string, now: Date) => {
      const row = this.invitations.find(
        (item) => item.tokenHash === tokenHash && item.status === "PENDING" && item.expiresAt > now,
      );
      return row ? { ...this.record(row), tenant: { name: "Kopi Lokal", status: "ACTIVE" } } : null;
    },
    findPending: async (tenantId: string, email: string) => {
      const row = this.invitations.find(
        (item) => item.tenantId === tenantId && item.email === email && item.status === "PENDING",
      );
      return row ? this.record(row) : null;
    },
    findTenantName: async () => "Kopi Lokal",
    findUserByEmail: async (email: string) => {
      const user = this.users.find((item) => item.email === email);
      return user ? { id: user.id, status: user.status } : null;
    },
    list: async (tenantId: string) =>
      this.invitations.filter((item) => item.tenantId === tenantId).map((row) => this.record(row)),
    reissue: async (tenantId: string, id: string, tokenHash: string, expiresAt: Date) => {
      const row = this.invitations.find((item) => item.tenantId === tenantId && item.id === id);
      if (!row || row.status !== "PENDING") return null;
      Object.assign(row, { expiresAt, tokenHash });
      this.audit.push("invitation.resend");
      return this.record(row);
    },
    revoke: async (tenantId: string, id: string, now: Date) => {
      const row = this.invitations.find((item) => item.tenantId === tenantId && item.id === id);
      if (!row || row.status !== "PENDING") return null;
      Object.assign(row, { revokedAt: now, status: "REVOKED", tokenHash: null });
      this.audit.push("invitation.revoke");
      return this.record(row);
    },
  };
}

function setup(limits?: { assertCanAdd: () => Promise<void> }) {
  const world = new World();
  const sent: InvitationMessage[] = [];
  const delivery: InvitationDelivery = {
    assertReady: () => undefined,
    send: async (message) => void sent.push(message),
  };
  const service = new InvitationService(
    world.repository,
    world.access,
    delivery,
    new InMemoryRateLimitService(),
    limits,
  );
  /** The secret from the newest link, as the invited person would have it. */
  const token = () => new URL(sent.at(-1)!.acceptUrl).hash.replace("#token=", "");
  return { sent, service, token, world };
}

const invite = (email = "baru@example.com") => ({
  allOutlets: false,
  email,
  outletIds: [OUTLET],
  roleIds: [ROLE],
});

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

test("an invitation is sent to the email only, and only the hash of its secret is kept", async () => {
  const { sent, service, token, world } = setup();
  const invitation = await service.create(TENANT, invite("  Baru@Example.com "), ACTOR, NOW);

  assert.equal(invitation.email, "baru@example.com");
  assert.equal(invitation.status, "PENDING");
  assert.equal(invitation.expiresAt, later(INVITATION_TTL_MS).toISOString());
  // The answer to the inviter carries no link and no secret.
  assert.equal(JSON.stringify(invitation).includes(token()), false);
  assert.equal(JSON.stringify(await service.list(TENANT, NOW)).includes(token()), false);

  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.email, "baru@example.com");
  assert.equal(sent[0]?.workspaceName, "Kopi Lokal");
  assert.match(token(), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(world.invitations[0]?.tokenHash, hashInvitationToken(token()));
  assert.equal(JSON.stringify(world.invitations).includes(token()), false);
});

test("the secret travels in the fragment of the link, which no server sees", () => {
  const url = new URL(invitationAcceptUrl("https://app.example.com/login", "t".repeat(43)));
  assert.equal(url.origin + url.pathname, "https://app.example.com/invite");
  assert.equal(url.search, "");
  assert.equal(url.hash, `#token=${"t".repeat(43)}`);
});

test("a new person accepts with a name and a password and becomes a member", async () => {
  const { service, token, world } = setup();
  await service.create(TENANT, invite(), ACTOR, NOW);

  const preview = await service.preview(token(), {}, later(60_000));
  assert.deepEqual(
    { accountExists: preview.accountExists, email: preview.email, name: preview.workspaceName },
    { accountExists: false, email: "baru@example.com", name: "Kopi Lokal" },
  );

  // Without the account details nothing happens.
  assert.equal(
    await codeOf(() => service.accept({ token: token() }, {}, undefined, later(60_000))),
    "400 INVITATION_ACCOUNT_REQUIRED",
  );
  const accepted = await service.accept(
    { displayName: "Kasir Baru", password: "rahasia-kuat-1", token: token() },
    {},
    undefined,
    later(120_000),
  );
  assert.deepEqual(accepted, { email: "baru@example.com", workspaceName: "Kopi Lokal" });

  const user = world.users.find((item) => item.email === "baru@example.com");
  assert.equal(user?.displayName, "Kasir Baru");
  // The password is stored hashed, and the right one opens it.
  assert.equal(user?.passwordHash.includes("rahasia-kuat-1"), false);
  assert.equal(await verifyPassword("rahasia-kuat-1", user!.passwordHash), true);
  assert.deepEqual(
    world.memberships.map((item) => [item.tenantId, item.userId, item.roleIds, item.outletIds]),
    [[TENANT, user!.id, [ROLE], [OUTLET]]],
  );
  assert.equal((await service.list(TENANT, later(120_000)))[0]?.status, "ACCEPTED");
});

test("a link works once", async () => {
  const { service, token } = setup();
  await service.create(TENANT, invite(), ACTOR, NOW);
  const body = { displayName: "Kasir Baru", password: "rahasia-kuat-1", token: token() };

  await service.accept(body, {}, undefined, later(1_000));
  assert.equal(
    await codeOf(() => service.accept(body, {}, undefined, later(2_000))),
    "400 INVITATION_INVALID",
  );
  assert.equal(
    await codeOf(() => service.preview(body.token, {}, later(2_000))),
    "400 INVITATION_INVALID",
  );
});

test("a person who already has an account joins with the link alone, and keeps their password", async () => {
  const { service, token, world } = setup();
  await service.create(TENANT, invite("lama@example.com"), ACTOR, NOW);
  assert.equal((await service.preview(token(), {}, NOW)).accountExists, true);

  await service.accept(
    // Details sent anyway must not overwrite an existing account.
    { displayName: "Nama Lain", password: "kata-sandi-lain", token: token() },
    {},
    undefined,
    later(1_000),
  );
  const user = world.users.find((item) => item.id === EXISTING_USER);
  assert.deepEqual([user?.displayName, user?.passwordHash], ["Sudah Punya Akun", "x"]);
  assert.equal(world.users.length, 1);
  assert.equal(world.memberships[0]?.userId, EXISTING_USER);
});

test("a wrong, expired, or withdrawn link all get the same answer", async () => {
  const { service, token } = setup();
  const invitation = await service.create(TENANT, invite(), ACTOR, NOW);
  const good = token();

  assert.equal(
    await codeOf(() => service.preview("w".repeat(43), {}, NOW)),
    "400 INVITATION_INVALID",
  );
  assert.equal(
    await codeOf(() => service.preview(good, {}, later(INVITATION_TTL_MS))),
    "400 INVITATION_INVALID",
  );
  await service.revoke(TENANT, invitation.id, ACTOR, later(1_000));
  assert.equal(
    await codeOf(() => service.preview(good, {}, later(2_000))),
    "400 INVITATION_INVALID",
  );
  assert.equal((await service.list(TENANT, later(2_000)))[0]?.status, "REVOKED");
});

test("sending again makes a new link and kills the old one", async () => {
  const { sent, service, token, world } = setup();
  const invitation = await service.create(TENANT, invite(), ACTOR, NOW);
  const first = token();

  const again = await service.resend(TENANT, invitation.id, ACTOR, later(60_000));
  assert.equal(sent.length, 2);
  assert.notEqual(token(), first);
  assert.equal(again.expiresAt, later(60_000 + INVITATION_TTL_MS).toISOString());
  assert.equal(
    await codeOf(() => service.preview(first, {}, later(61_000))),
    "400 INVITATION_INVALID",
  );
  assert.ok(await service.preview(token(), {}, later(61_000)));
  assert.deepEqual(world.audit, ["invitation.create", "invitation.resend"]);
});

test("an email gets one open invitation, and none when it is already a member", async () => {
  const { service, world } = setup();
  await service.create(TENANT, invite(), ACTOR, NOW);
  assert.equal(
    await codeOf(() => service.create(TENANT, invite(), ACTOR, later(1_000))),
    "409 INVITATION_PENDING",
  );

  world.memberships.push({ tenantId: TENANT, userId: EXISTING_USER });
  assert.equal(
    await codeOf(() => service.create(TENANT, invite("lama@example.com"), ACTOR, NOW)),
    "409 MEMBERSHIP_CONFLICT",
  );
  assert.equal(world.invitations.length, 1);
});

test("an invitation that ran out is shown as expired and can be replaced", async () => {
  const { service, world } = setup();
  await service.create(TENANT, invite(), ACTOR, NOW);
  const afterDeadline = later(INVITATION_TTL_MS + 1_000);

  assert.equal((await service.list(TENANT, afterDeadline))[0]?.status, "EXPIRED");
  const fresh = await service.create(TENANT, invite(), ACTOR, afterDeadline);
  assert.equal(fresh.status, "PENDING");
  assert.deepEqual(
    world.invitations.map((item) => item.status),
    ["EXPIRED", "PENDING"],
  );
});

test("only roles and outlets of this workspace can be granted", async () => {
  const { service, world } = setup();
  assert.equal(
    await codeOf(() =>
      service.create(TENANT, { ...invite(), roleIds: [OTHER_TENANT] }, ACTOR, NOW),
    ),
    "404 ROLE_NOT_FOUND",
  );
  assert.equal(
    await codeOf(() =>
      service.create(TENANT, { ...invite(), outletIds: [OTHER_TENANT] }, ACTOR, NOW),
    ),
    "404 OUTLET_NOT_FOUND",
  );
  assert.equal(
    await codeOf(() => service.create(OTHER_TENANT, invite(), ACTOR, NOW)),
    "404 TENANT_NOT_FOUND",
  );
  assert.equal(world.invitations.length, 0);
});

test("a role that was switched off after inviting stops the acceptance", async () => {
  const { service, token, world } = setup();
  await service.create(TENANT, { ...invite(), roleIds: [OLD_ROLE] }, ACTOR, NOW);
  world.roles.set(OLD_ROLE, "INACTIVE");

  assert.equal(
    await codeOf(() =>
      service.accept(
        { displayName: "Kasir Baru", password: "rahasia-kuat-1", token: token() },
        {},
        undefined,
        later(1_000),
      ),
    ),
    "409 INVITATION_OUTDATED",
  );
  assert.equal(world.memberships.length, 0);
  assert.equal(world.users.length, 1);
});

test("another workspace cannot see, resend, or withdraw an invitation", async () => {
  const { sent, service } = setup();
  const invitation = await service.create(TENANT, invite(), ACTOR, NOW);

  assert.deepEqual(await service.list(OTHER_TENANT, NOW), []);
  assert.equal(
    await codeOf(() => service.resend(OTHER_TENANT, invitation.id, ACTOR, NOW)),
    "404 INVITATION_NOT_FOUND",
  );
  assert.equal(
    await codeOf(() => service.revoke(OTHER_TENANT, invitation.id, ACTOR, NOW)),
    "404 INVITATION_NOT_FOUND",
  );
  assert.equal(sent.length, 1);
});

test("a full user limit refuses the invitation, and again the acceptance", async () => {
  let full = true;
  const { service, token, world } = setup({
    assertCanAdd: async () => {
      if (full) throw new HttpException({ code: "LIMIT_REACHED" }, 409);
    },
  });
  assert.equal(
    await codeOf(() => service.create(TENANT, invite(), ACTOR, NOW)),
    "409 LIMIT_REACHED",
  );
  assert.equal(world.invitations.length, 0);

  full = false;
  await service.create(TENANT, invite(), ACTOR, NOW);
  // The seat was taken by someone else in the meantime.
  full = true;
  assert.equal(
    await codeOf(() =>
      service.accept(
        { displayName: "Kasir Baru", password: "rahasia-kuat-1", token: token() },
        {},
        undefined,
        later(1_000),
      ),
    ),
    "409 LIMIT_REACHED",
  );
  assert.equal(world.memberships.length, 0);
});

test("hammering links is held back per network address", async () => {
  const { service } = setup();
  const attempt = (ipAddress: string) =>
    codeOf(() => service.preview("w".repeat(43), { ipAddress }, NOW));
  for (let index = 0; index < 20; index += 1) {
    assert.equal(await attempt("10.0.0.1"), "400 INVITATION_INVALID");
  }
  assert.equal(await attempt("10.0.0.1"), "429 RATE_LIMIT_EXCEEDED");
  assert.equal(await attempt("10.0.0.2"), "400 INVITATION_INVALID");
});

test("without a mail service, production refuses to invite instead of pretending to send", async () => {
  const production = createInvitationDelivery({ NODE_ENV: "production" });
  const world = new World();
  const service = new InvitationService(world.repository, world.access, production);

  assert.equal(
    await codeOf(() => service.create(TENANT, invite(), ACTOR, NOW)),
    "503 MAIL_NOT_CONFIGURED",
  );
  // Nothing was stored that nobody could ever receive.
  assert.equal(world.invitations.length, 0);
  // Outside production the link goes to the API's own output for the developer.
  assert.doesNotThrow(() => createInvitationDelivery({ NODE_ENV: "development" }).assertReady());
});
