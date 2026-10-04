import { randomBytes, createHash } from "node:crypto";

import {
  acceptInvitationSchema,
  createInvitationSchema,
  invitationAcceptedSchema,
  invitationPreviewSchema,
  invitationSchema,
  type AcceptInvitation,
  type CreateInvitation,
  type Invitation,
} from "@merchant/contracts";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";

import type { ActorCommandOrigin, CommandOrigin } from "../../shared/command/command-origin.js";
import { LIMIT_GATE, NO_LIMITS, type LimitGate } from "../../shared/limits/limit-gate.js";
import { hashPassword } from "../auth/public.js";
import {
  buildInvitationRateLimitKey,
  InMemoryRateLimitService,
  RATE_LIMIT_POLICIES,
  RATE_LIMIT_SERVICE,
  type RateLimitService,
} from "../security/public.js";
import { ACCESS_REPOSITORY, type AccessRepository } from "./access.repository.js";
import {
  INVITATION_DELIVERY,
  invitationAcceptUrl,
  type InvitationDelivery,
} from "./invitation-delivery.js";
import {
  INVITATION_REPOSITORY,
  type InvitationRecord,
  type InvitationRepository,
} from "./invitation.repository.js";

/** How long an invitation can be accepted. */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

function createToken() {
  return randomBytes(32).toString("base64url");
}

/** The secret is random and long, so a fast hash is enough to store it. */
export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toInvitation(record: InvitationRecord, now: Date): Invitation {
  return invitationSchema.parse({
    acceptedAt: record.acceptedAt?.toISOString() ?? null,
    allOutlets: record.allOutlets,
    createdAt: record.createdAt.toISOString(),
    email: record.email,
    expiresAt: record.expiresAt.toISOString(),
    id: record.id,
    outletIds: record.outletIds,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    roleIds: record.roleIds,
    // A pending invitation past its deadline is shown as what it is.
    status: record.status === "PENDING" && record.expiresAt <= now ? "EXPIRED" : record.status,
    workspaceId: record.tenantId,
  });
}

function conflict(code: string, message: string) {
  return new ConflictException({ code, message });
}

function notFound(code: string, message: string) {
  return new NotFoundException({ code, message });
}

/** A wrong, used, revoked, or expired link all look the same from outside. */
function invalidLink() {
  return new BadRequestException({
    code: "INVITATION_INVALID",
    message: "This invitation link is wrong or no longer valid.",
  });
}

/** Inviting people into a workspace, and letting them in when they accept. */
@Injectable()
export class InvitationService {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly repository: InvitationRepository,
    @Inject(ACCESS_REPOSITORY) private readonly access: AccessRepository,
    @Inject(INVITATION_DELIVERY) private readonly delivery: InvitationDelivery,
    @Optional()
    @Inject(RATE_LIMIT_SERVICE)
    private readonly rateLimit: RateLimitService = new InMemoryRateLimitService(),
    @Optional() @Inject(LIMIT_GATE) private readonly limits: LimitGate = NO_LIMITS,
  ) {}

  private async requireActiveTenant(tenantId: string) {
    const tenant = await this.access.findTenant(tenantId);
    if (!tenant) throw notFound("TENANT_NOT_FOUND", "Workspace was not found.");
    if (tenant.status !== "ACTIVE") throw conflict("TENANT_INACTIVE", "Workspace is not active.");
  }

  /** The roles and outlets an invitation grants must exist and be active. */
  private async requireGrantable(
    tenantId: string,
    grant: { outletIds: string[]; roleIds: string[] },
    outdated = false,
  ) {
    const [roles, outlets] = await Promise.all([
      this.access.findRoles(tenantId, grant.roleIds),
      grant.outletIds.length > 0 ? this.access.findOutlets(tenantId, grant.outletIds) : [],
    ]);
    const rolesOk =
      roles.length === grant.roleIds.length && roles.every((role) => role.status === "ACTIVE");
    const outletsOk =
      outlets.length === grant.outletIds.length &&
      outlets.every((outlet) => outlet.status === "ACTIVE");
    if (rolesOk && outletsOk) return;
    if (outdated) {
      throw conflict(
        "INVITATION_OUTDATED",
        "A role or outlet of this invitation is no longer available. Ask for a new invitation.",
      );
    }
    throw rolesOk
      ? notFound("OUTLET_NOT_FOUND", "An outlet was not found or is not active.")
      : notFound("ROLE_NOT_FOUND", "A role was not found or is not active.");
  }

  private async deliver(record: InvitationRecord, token: string) {
    await this.delivery.send({
      acceptUrl: invitationAcceptUrl(process.env.WEB_URL, token),
      email: record.email,
      expiresAt: record.expiresAt,
      workspaceName: await this.repository.findTenantName(record.tenantId),
    });
  }

  async list(tenantId: string, now = new Date()) {
    return (await this.repository.list(tenantId)).map((record) => toInvitation(record, now));
  }

  /** Invites an email address. The link goes to that address only. */
  async create(
    tenantId: string,
    input: CreateInvitation,
    context: ActorCommandOrigin,
    now = new Date(),
  ) {
    this.delivery.assertReady();
    await this.requireActiveTenant(tenantId);
    const parsed = createInvitationSchema.parse(input);
    await this.requireGrantable(tenantId, parsed);

    const user = await this.repository.findUserByEmail(parsed.email);
    if (user && (await this.access.findMembershipByUser(tenantId, user.id))) {
      throw conflict("MEMBERSHIP_CONFLICT", "This person is already a member of the workspace.");
    }
    await this.repository.expireStale(tenantId, parsed.email, now);
    if (await this.repository.findPending(tenantId, parsed.email)) {
      throw conflict("INVITATION_PENDING", "This email already has an open invitation.");
    }
    await this.limits.assertCanAdd(tenantId, "core.users.active");

    const token = createToken();
    const record = await this.repository.create(
      tenantId,
      {
        allOutlets: parsed.allOutlets,
        email: parsed.email,
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
        outletIds: parsed.outletIds,
        roleIds: parsed.roleIds,
        tokenHash: hashInvitationToken(token),
      },
      context,
    );
    await this.deliver(record, token);
    return toInvitation(record, now);
  }

  /** Sends a fresh link; the old one stops working. */
  async resend(tenantId: string, id: string, context: ActorCommandOrigin, now = new Date()) {
    this.delivery.assertReady();
    if (!(await this.repository.findById(tenantId, id))) {
      throw notFound("INVITATION_NOT_FOUND", "The invitation was not found.");
    }
    const token = createToken();
    const record = await this.repository.reissue(
      tenantId,
      id,
      hashInvitationToken(token),
      new Date(now.getTime() + INVITATION_TTL_MS),
      context,
    );
    if (!record) {
      throw conflict("INVITATION_NOT_PENDING", "Only an open invitation can be sent again.");
    }
    await this.deliver(record, token);
    return toInvitation(record, now);
  }

  async revoke(tenantId: string, id: string, context: ActorCommandOrigin, now = new Date()) {
    if (!(await this.repository.findById(tenantId, id))) {
      throw notFound("INVITATION_NOT_FOUND", "The invitation was not found.");
    }
    const record = await this.repository.revoke(tenantId, id, now, context);
    if (!record) {
      throw conflict("INVITATION_NOT_PENDING", "Only an open invitation can be withdrawn.");
    }
    return toInvitation(record, now);
  }

  private async byToken(token: string, ipAddress: string | undefined, now: Date) {
    await this.rateLimit.consume(
      buildInvitationRateLimitKey(ipAddress),
      RATE_LIMIT_POLICIES.invitationLink,
    );
    const found = await this.repository.findByToken(hashInvitationToken(token), now);
    if (!found || found.tenant.status !== "ACTIVE") throw invalidLink();
    return found;
  }

  /** What the invited person sees before accepting. */
  async preview(token: string, metadata: { ipAddress?: string } = {}, now = new Date()) {
    const found = await this.byToken(token, metadata.ipAddress, now);
    const user = await this.repository.findUserByEmail(found.email);
    return invitationPreviewSchema.parse({
      accountExists: Boolean(user),
      email: found.email,
      expiresAt: found.expiresAt.toISOString(),
      workspaceName: found.tenant.name,
    });
  }

  /**
   * Lets the invited person in. Someone without an account gives a name and a
   * password; someone with an account needs nothing but the link.
   */
  async accept(
    input: AcceptInvitation,
    metadata: { ipAddress?: string } = {},
    context?: CommandOrigin,
    now = new Date(),
  ) {
    const parsed = acceptInvitationSchema.parse(input);
    const found = await this.byToken(parsed.token, metadata.ipAddress, now);
    await this.requireGrantable(found.tenantId, found, true);

    const user = await this.repository.findUserByEmail(found.email);
    if (user && user.status !== "ACTIVE") throw invalidLink();
    if (user && (await this.access.findMembershipByUser(found.tenantId, user.id))) {
      throw conflict("MEMBERSHIP_CONFLICT", "This person is already a member of the workspace.");
    }
    if (!user && (!parsed.displayName || !parsed.password)) {
      throw new BadRequestException({
        code: "INVITATION_ACCOUNT_REQUIRED",
        message: "A name and a password are needed to create the account.",
      });
    }
    await this.limits.assertCanAdd(found.tenantId, "core.users.active");

    const account =
      !user && parsed.displayName && parsed.password
        ? { displayName: parsed.displayName, passwordHash: await hashPassword(parsed.password) }
        : undefined;
    const membership = await this.repository.accept(
      hashInvitationToken(parsed.token),
      account,
      now,
      context,
    );
    if (!membership) throw invalidLink();
    return invitationAcceptedSchema.parse({
      email: found.email,
      workspaceName: found.tenant.name,
    });
  }
}
