import {
  deviceActivationTicketSchema,
  deviceSchema,
  registerDeviceSchema,
  type Device,
  type DeviceMode,
  type RegisterDevice,
} from "@merchant/contracts";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
  type OnModuleInit,
} from "@nestjs/common";

import type { ActorCommandOrigin, CommandOrigin } from "../../shared/command/command-origin.js";
import type { DeviceAuthenticator } from "../../shared/devices/device-identity.js";
import {
  LIMIT_GATE,
  NO_LIMITS,
  USAGE_GAUGE_REGISTRY,
  type LimitGate,
  type UsageGaugeRegistry,
} from "../../shared/limits/limit-gate.js";
import {
  buildDeviceActivationRateLimitKey,
  InMemoryRateLimitService,
  RATE_LIMIT_POLICIES,
  RATE_LIMIT_SERVICE,
  type RateLimitService,
} from "../security/public.js";
import {
  ACTIVATION_CODE_TTL_MS,
  createActivationCode,
  createDeviceCredential,
  formatActivationCode,
  hashDeviceSecret,
} from "./device-credential.js";
import {
  DEVICE_REPOSITORY,
  type DeviceRecord,
  type DeviceRepository,
} from "./device.repository.js";

/** The limit a device of each mode counts against. */
const DIMENSION_BY_MODE: Record<DeviceMode, string> = {
  KDS: "kds.devices.active",
  POS: "pos.registers.active",
};

/** "Last seen" is for people looking at a list; writing it on every request would be waste. */
const LAST_SEEN_INTERVAL_MS = 5 * 60 * 1_000;

function toDevice(record: DeviceRecord): Device {
  return deviceSchema.parse({
    activatedAt: record.activatedAt?.toISOString() ?? null,
    activationExpiresAt: record.activationExpiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    label: record.label,
    lastSeenAt: record.lastSeenAt?.toISOString() ?? null,
    mode: record.mode,
    outletId: record.outletId,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    status: record.status,
    workspaceId: record.tenantId,
  });
}

function notFound() {
  return new NotFoundException({ code: "DEVICE_NOT_FOUND", message: "Device was not found." });
}

/**
 * The devices of a workspace (security.md 12). A device is registered by a
 * person, activated once with a short code, and then proves itself with a
 * credential of its own, separate from the session of whoever uses it.
 */
@Injectable()
export class DeviceService implements DeviceAuthenticator, OnModuleInit {
  constructor(
    @Inject(DEVICE_REPOSITORY) private readonly repository: DeviceRepository,
    @Optional()
    @Inject(RATE_LIMIT_SERVICE)
    private readonly rateLimit: RateLimitService = new InMemoryRateLimitService(),
    @Optional() @Inject(LIMIT_GATE) private readonly limits: LimitGate = NO_LIMITS,
    @Optional() @Inject(USAGE_GAUGE_REGISTRY) private readonly gauges?: UsageGaugeRegistry,
  ) {}

  /** A device counts against its limit from registration until it is revoked. */
  onModuleInit() {
    for (const mode of Object.keys(DIMENSION_BY_MODE) as DeviceMode[]) {
      this.gauges?.register(DIMENSION_BY_MODE[mode], async (tenantId) =>
        BigInt(await this.repository.countInUse(tenantId, mode)),
      );
    }
  }

  async list(tenantId: string) {
    return (await this.repository.list(tenantId)).map(toDevice);
  }

  private newCode(now: Date) {
    const code = createActivationCode();
    return {
      activationCodeHash: hashDeviceSecret(code),
      activationExpiresAt: new Date(now.getTime() + ACTIVATION_CODE_TTL_MS),
      code,
    };
  }

  /** Registers a device and returns its activation code. The code is shown this once. */
  async register(
    tenantId: string,
    input: RegisterDevice,
    context: ActorCommandOrigin,
    now = new Date(),
  ) {
    const parsed = registerDeviceSchema.parse(input);
    const outlet = await this.repository.findOutlet(tenantId, parsed.outletId);
    if (!outlet) {
      throw new NotFoundException({ code: "OUTLET_NOT_FOUND", message: "Outlet was not found." });
    }
    if (outlet.status !== "ACTIVE") {
      throw new ConflictException({ code: "OUTLET_INACTIVE", message: "Outlet is not active." });
    }
    await this.limits.assertCanAdd(tenantId, DIMENSION_BY_MODE[parsed.mode]);

    const { code, ...secret } = this.newCode(now);
    const device = await this.repository.create(tenantId, { ...parsed, ...secret }, context);
    return deviceActivationTicketSchema.parse({
      activationCode: formatActivationCode(code),
      device: toDevice(device),
    });
  }

  /** A new code for a device that was never activated, e.g. after the first one expired. */
  async reissueCode(tenantId: string, id: string, context: ActorCommandOrigin, now = new Date()) {
    if (!(await this.repository.findById(tenantId, id))) throw notFound();
    const { code, ...secret } = this.newCode(now);
    const device = await this.repository.reissueCode(
      tenantId,
      id,
      secret.activationCodeHash,
      secret.activationExpiresAt,
      context,
    );
    if (!device) {
      throw new ConflictException({
        code: "DEVICE_NOT_PENDING",
        message: "Only a device that was never activated can get a new code.",
      });
    }
    return deviceActivationTicketSchema.parse({
      activationCode: formatActivationCode(code),
      device: toDevice(device),
    });
  }

  /** Stops the device at once: its credential and any unused code no longer work. */
  async revoke(tenantId: string, id: string, context: ActorCommandOrigin, now = new Date()) {
    if (!(await this.repository.findById(tenantId, id))) throw notFound();
    const device = await this.repository.revoke(tenantId, id, now, context);
    if (!device) {
      throw new ConflictException({
        code: "DEVICE_ALREADY_REVOKED",
        message: "This device was already revoked.",
      });
    }
    return toDevice(device);
  }

  /**
   * Called from the device itself with the code a person read to it. A wrong,
   * expired, or used code all get the same answer, and attempts are limited
   * per network address.
   */
  async activate(
    code: string,
    metadata: { ipAddress?: string } = {},
    context?: CommandOrigin,
    now = new Date(),
  ) {
    await this.rateLimit.consume(
      buildDeviceActivationRateLimitKey(metadata.ipAddress),
      RATE_LIMIT_POLICIES.deviceActivation,
    );
    const credential = createDeviceCredential();
    const device = await this.repository.activate(
      hashDeviceSecret(code),
      hashDeviceSecret(credential),
      now,
      context,
    );
    if (!device) {
      throw new BadRequestException({
        code: "DEVICE_ACTIVATION_INVALID",
        message: "This activation code is wrong or no longer valid.",
      });
    }
    return { credential, device: toDevice(device) };
  }

  /** The active device that holds this credential, or undefined. Never throws. */
  async authenticate(credential: string | undefined, now = new Date()) {
    if (!credential) return undefined;
    const device = await this.repository.findByCredential(hashDeviceSecret(credential));
    if (!device) return undefined;
    if (
      !device.lastSeenAt ||
      now.getTime() - device.lastSeenAt.getTime() >= LAST_SEEN_INTERVAL_MS
    ) {
      await this.repository.touch(device.id, now);
      device.lastSeenAt = now;
    }
    return toDevice(device);
  }

  /** For endpoints only a device may call. */
  async requireDevice(credential: string | undefined, now = new Date()) {
    const device = await this.authenticate(credential, now);
    if (!device) {
      throw new UnauthorizedException({
        code: "DEVICE_NOT_ACTIVATED",
        message: "This device is not activated or was revoked.",
      });
    }
    return device;
  }
}
