import type { PermissionKey } from "@merchant/contracts";
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { hashPassword, verifyPassword } from "../auth/public.js";
import type { CommandOrigin } from "../../shared/command/command-origin.js";
import { AccessService } from "./access.service.js";
import { APPROVAL_PIN_REPOSITORY, type ApprovalPinRepository } from "./approval-pin.repository.js";

/** Wrong tries in a row before a PIN is locked, and for how long. */
export const APPROVAL_PIN_MAX_ATTEMPTS = 5;
export const APPROVAL_PIN_LOCK_MS = 15 * 60_000;

/** PINs a person would guess first; refused so a lock is not the only protection. */
function isGuessable(pin: string) {
  if (/^(\d)\1+$/.test(pin)) return true;
  const steps = [...pin].slice(1).map((digit, index) => Number(digit) - Number(pin[index]));
  return steps.every((step) => step === 1) || steps.every((step) => step === -1);
}

export type Approver = { displayName: string; userId: string };

/**
 * The PIN a person with a permission types on someone else's screen to let an
 * action through there (flowchart.md 5.4). The PIN proves who approved; the
 * permission is still checked against that person's own membership, at the
 * location where the action happens.
 */
@Injectable()
export class ApprovalPinService {
  constructor(
    @Inject(APPROVAL_PIN_REPOSITORY) private readonly pins: ApprovalPinRepository,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  /** Replaced in tests to move time. */
  now: () => Date = () => new Date();

  /** Whether this person may approve at all, and whether they have set a PIN. */
  async status(tenantId: string, userId: string, canApprove: boolean) {
    return { canApprove, hasPin: canApprove && (await this.pins.find(tenantId, userId)) !== null };
  }

  /** A person sets their own PIN; nobody else ever knows it. */
  async setOwn(tenantId: string, userId: string, pin: string, context?: CommandOrigin) {
    if (isGuessable(pin)) {
      throw new ConflictException({
        code: "APPROVAL_PIN_TOO_SIMPLE",
        message: "Choose a PIN that is not one repeated digit or a run of digits.",
      });
    }
    await this.pins.save(tenantId, userId, await hashPassword(pin), {
      action: "approval_pin.set",
      ...(context ? { context } : {}),
      userId,
    });
  }

  /** Removes a member's PIN, e.g. when it was forgotten. They set a new one themselves. */
  async reset(tenantId: string, userId: string, context?: CommandOrigin) {
    const removed = await this.pins.delete(tenantId, userId, {
      action: "approval_pin.reset",
      ...(context ? { context } : {}),
      userId,
    });
    if (!removed) {
      throw new NotFoundException({
        code: "APPROVAL_PIN_NOT_SET",
        message: "This member has no approval PIN.",
      });
    }
  }

  async userIdsWithPin(tenantId: string) {
    return this.pins.userIdsWithPin(tenantId);
  }

  private async mayApprove(
    tenantId: string,
    outletId: string,
    userId: string,
    permission: PermissionKey,
  ) {
    const access = await this.access.describeAccess(userId, tenantId, outletId);
    return (
      access.membershipActive &&
      access.context !== null &&
      access.context.permissionKeys.includes(permission) &&
      access.location?.active === true &&
      access.location.inScope
    );
  }

  /** People who can approve this action at this location right now, by name. */
  async approvers(
    tenantId: string,
    outletId: string,
    permission: PermissionKey,
    exceptUserId: string,
  ): Promise<Approver[]> {
    const approvers: Approver[] = [];
    for (const pin of await this.pins.list(tenantId)) {
      if (pin.userId === exceptUserId) continue;
      if (await this.mayApprove(tenantId, outletId, pin.userId, permission)) {
        approvers.push({ displayName: pin.displayName, userId: pin.userId });
      }
    }
    return approvers;
  }

  /**
   * Checks the approver's PIN for an action at a location. Wrong tries are
   * counted on the approver, whoever is typing, so the limit cannot be dodged
   * by moving to another device.
   */
  async verify(
    input: {
      approverUserId: string;
      outletId: string;
      permission: PermissionKey;
      pin: string;
      tenantId: string;
    },
    context?: CommandOrigin,
  ): Promise<Approver> {
    const { approverUserId, outletId, permission, pin, tenantId } = input;
    // The same answer whether the person, the PIN, or the permission is missing.
    const refused = () =>
      new ForbiddenException({
        code: "APPROVAL_PIN_INVALID",
        message: "The approval was refused.",
      });

    const record = await this.pins.find(tenantId, approverUserId);
    if (!record || !(await this.mayApprove(tenantId, outletId, approverUserId, permission))) {
      throw refused();
    }
    const now = this.now();
    if (record.lockedUntil && record.lockedUntil > now) {
      throw new ForbiddenException({
        code: "APPROVAL_PIN_LOCKED",
        details: { lockedUntil: record.lockedUntil.toISOString() },
        message: "This PIN is locked after too many wrong tries.",
      });
    }
    if (await verifyPassword(pin, record.pinHash)) {
      await this.pins.recordSuccess(tenantId, approverUserId);
      return { displayName: record.displayName, userId: record.userId };
    }
    const state = await this.pins.recordFailure(
      tenantId,
      approverUserId,
      APPROVAL_PIN_MAX_ATTEMPTS,
      new Date(now.getTime() + APPROVAL_PIN_LOCK_MS),
      { ...(context ? { context } : {}), userId: approverUserId },
    );
    if (state.lockedUntil && state.lockedUntil > now) {
      throw new ForbiddenException({
        code: "APPROVAL_PIN_LOCKED",
        details: { lockedUntil: state.lockedUntil.toISOString() },
        message: "This PIN is locked after too many wrong tries.",
      });
    }
    throw new ForbiddenException({
      code: "APPROVAL_PIN_INVALID",
      details: { attemptsLeft: String(APPROVAL_PIN_MAX_ATTEMPTS - state.failedAttempts) },
      message: "The approval was refused.",
    });
  }
}
