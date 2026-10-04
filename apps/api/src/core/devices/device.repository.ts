import type { DeviceMode, DeviceStatus } from "@merchant/contracts";
import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

import type { ActorCommandOrigin, CommandOrigin } from "../../shared/command/command-origin.js";
import { buildAuditMetadata, buildAuditPayload } from "../audit/public.js";

/** A device as the application sees it. Hashes never leave the repository. */
export type DeviceRecord = {
  activatedAt: Date | null;
  activationExpiresAt: Date | null;
  createdAt: Date;
  id: string;
  label: string;
  lastSeenAt: Date | null;
  mode: DeviceMode;
  outletId: string;
  revokedAt: Date | null;
  status: DeviceStatus;
  tenantId: string;
};

export type NewDevice = {
  activationCodeHash: string;
  activationExpiresAt: Date;
  label: string;
  mode: DeviceMode;
  outletId: string;
};

export interface DeviceRepository {
  /**
   * Turns the pending device that holds this unexpired code into an active
   * one with the given credential. Null when no such device exists, so a code
   * works exactly once.
   */
  activate(
    activationCodeHash: string,
    credentialHash: string,
    now: Date,
    context?: CommandOrigin,
  ): Promise<DeviceRecord | null>;
  countInUse(tenantId: string, mode: DeviceMode): Promise<number>;
  create(tenantId: string, device: NewDevice, context: ActorCommandOrigin): Promise<DeviceRecord>;
  /** The active device that holds this credential. */
  findByCredential(credentialHash: string): Promise<DeviceRecord | null>;
  findById(tenantId: string, id: string): Promise<DeviceRecord | null>;
  findOutlet(tenantId: string, outletId: string): Promise<{ status: string } | null>;
  list(tenantId: string): Promise<DeviceRecord[]>;
  /** Replaces the code of a device that is still pending; null when it is not. */
  reissueCode(
    tenantId: string,
    id: string,
    activationCodeHash: string,
    activationExpiresAt: Date,
    context: ActorCommandOrigin,
  ): Promise<DeviceRecord | null>;
  /** Null when the device was already revoked. */
  revoke(
    tenantId: string,
    id: string,
    now: Date,
    context: ActorCommandOrigin,
  ): Promise<DeviceRecord | null>;
  touch(id: string, now: Date): Promise<void>;
}

export const DEVICE_REPOSITORY = Symbol("DEVICE_REPOSITORY");

const select = {
  activatedAt: true,
  activationExpiresAt: true,
  createdAt: true,
  id: true,
  label: true,
  lastSeenAt: true,
  mode: true,
  outletId: true,
  revokedAt: true,
  status: true,
  tenantId: true,
} as const;

type Transaction = Parameters<Parameters<ReturnType<typeof getPrismaClient>["$transaction"]>[0]>[0];

async function audit(
  transaction: Transaction,
  action: string,
  device: DeviceRecord,
  before: DeviceStatus | null,
  context: CommandOrigin | undefined,
) {
  const payload = buildAuditPayload({
    after: { label: device.label, mode: device.mode, status: device.status },
    ...(before ? { before: { status: before } } : {}),
  });
  await transaction.auditLog.create({
    data: {
      action,
      ...(context?.actorId ? { actorId: context.actorId } : {}),
      entityId: device.id,
      entityType: "device",
      metadata: buildAuditMetadata(action, payload),
      outletId: device.outletId,
      ...(context?.requestId ? { requestId: context.requestId } : {}),
      tenantId: device.tenantId,
    },
  });
}

@Injectable()
export class PrismaDeviceRepository implements DeviceRepository {
  async findOutlet(tenantId: string, outletId: string) {
    return getPrismaClient().outlet.findFirst({
      select: { status: true },
      where: { id: outletId, tenantId },
    });
  }

  async list(tenantId: string) {
    return getPrismaClient().coreDevice.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select,
      where: { tenantId },
    });
  }

  async findById(tenantId: string, id: string) {
    return getPrismaClient().coreDevice.findFirst({ select, where: { id, tenantId } });
  }

  async findByCredential(credentialHash: string) {
    return getPrismaClient().coreDevice.findFirst({
      select,
      where: { credentialHash, status: "ACTIVE" },
    });
  }

  async countInUse(tenantId: string, mode: DeviceMode) {
    return getPrismaClient().coreDevice.count({
      where: { mode, status: { not: "REVOKED" }, tenantId },
    });
  }

  async create(tenantId: string, device: NewDevice, context: ActorCommandOrigin) {
    return getPrismaClient().$transaction(async (transaction) => {
      const created = await transaction.coreDevice.create({
        data: { ...device, createdBy: context.actorId, status: "PENDING", tenantId },
        select,
      });
      await audit(transaction, "device.register", created, null, context);
      return created;
    });
  }

  async reissueCode(
    tenantId: string,
    id: string,
    activationCodeHash: string,
    activationExpiresAt: Date,
    context: ActorCommandOrigin,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const updated = await transaction.coreDevice.updateMany({
        data: { activationCodeHash, activationExpiresAt, updatedAt: new Date() },
        where: { id, status: "PENDING", tenantId },
      });
      if (updated.count === 0) return null;
      const device = await transaction.coreDevice.findUniqueOrThrow({ select, where: { id } });
      await audit(transaction, "device.reissue_code", device, "PENDING", context);
      return device;
    });
  }

  async activate(
    activationCodeHash: string,
    credentialHash: string,
    now: Date,
    context?: CommandOrigin,
  ) {
    return getPrismaClient().$transaction(async (transaction) => {
      const pending = await transaction.coreDevice.findFirst({
        select: { id: true },
        where: { activationCodeHash, activationExpiresAt: { gt: now }, status: "PENDING" },
      });
      if (!pending) return null;
      // The status in the condition makes two devices typing the same code race for one row.
      const updated = await transaction.coreDevice.updateMany({
        data: {
          activatedAt: now,
          activationCodeHash: null,
          activationExpiresAt: null,
          credentialHash,
          lastSeenAt: now,
          status: "ACTIVE",
          updatedAt: now,
        },
        where: { activationCodeHash, id: pending.id, status: "PENDING" },
      });
      if (updated.count === 0) return null;
      const device = await transaction.coreDevice.findUniqueOrThrow({
        select,
        where: { id: pending.id },
      });
      await audit(transaction, "device.activate", device, "PENDING", context);
      return device;
    });
  }

  async revoke(tenantId: string, id: string, now: Date, context: ActorCommandOrigin) {
    return getPrismaClient().$transaction(async (transaction) => {
      const current = await transaction.coreDevice.findFirst({
        select: { status: true },
        where: { id, tenantId },
      });
      if (!current || current.status === "REVOKED") return null;
      const updated = await transaction.coreDevice.updateMany({
        data: {
          activationCodeHash: null,
          activationExpiresAt: null,
          credentialHash: null,
          revokedAt: now,
          revokedBy: context.actorId,
          status: "REVOKED",
          updatedAt: now,
        },
        where: { id, status: current.status, tenantId },
      });
      if (updated.count === 0) return null;
      // Sign-ins opened on the device stop working without its credential
      // anyway; closing them keeps the session list truthful.
      await transaction.loginSession.updateMany({
        data: { revokedAt: now },
        where: { deviceId: id, revokedAt: null },
      });
      const device = await transaction.coreDevice.findUniqueOrThrow({ select, where: { id } });
      await audit(transaction, "device.revoke", device, current.status, context);
      return device;
    });
  }

  async touch(id: string, now: Date) {
    await getPrismaClient().coreDevice.updateMany({
      data: { lastSeenAt: now },
      where: { id, status: "ACTIVE" },
    });
  }
}
