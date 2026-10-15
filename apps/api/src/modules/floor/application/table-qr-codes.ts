import {
  MODULES,
  publicQrResolutionSchema,
  tableQrSchema,
  type PublicQrResolution,
} from "@merchant/contracts";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { EntitlementService } from "../../../core/entitlements/public.js";
import type { CommandOrigin } from "../../../shared/command/command-origin.js";
import { hashQrToken, isQrToken, newQrSalt, qrTokenOf } from "../domain/qr-token.js";
import {
  TABLE_QR_REPOSITORY,
  TABLE_QR_SECRET,
  type QrTokenRecord,
  type TableQrRepository,
} from "./table-qr.repository.js";

/** Where guests land; the token is the last part of the address. */
export function tableQrUrl(webUrl: string, token: string) {
  return `${webUrl.replace(/\/+$/, "")}/t/${token}`;
}

const invalid = (): PublicQrResolution =>
  publicQrResolutionSchema.parse({
    merchantName: null,
    message: null,
    outletName: null,
    status: "INVALID",
    tableLabel: null,
  });

/**
 * Table QR codes: made, printed again, rotated, and revoked by staff, and
 * read by guests. A guest only learns the business, outlet, and table names.
 */
@Injectable()
export class TableQrCodes {
  constructor(
    @Inject(TABLE_QR_REPOSITORY) private readonly codes: TableQrRepository,
    @Inject(TABLE_QR_SECRET) private readonly secret: string,
    @Inject(EntitlementService) private readonly entitlements: EntitlementService,
  ) {}

  /** The web app guests open; read once, like the invitation links. */
  private readonly webUrl = process.env.WEB_URL ?? "http://localhost:3000";

  async get(tenantId: string, outletId: string, tableId: string) {
    const { latest, table } = await this.codes.current(tenantId, outletId, tableId);
    if (!table) throw tableNotFound();
    return this.toQr(latest);
  }

  /** Makes the table's QR; asking again while one works returns that one. */
  async generate(tenantId: string, outletId: string, tableId: string, origin: CommandOrigin) {
    const { latest, table } = await this.codes.current(tenantId, outletId, tableId);
    if (!table) throw tableNotFound();
    if (latest?.status === "ACTIVE") return this.toQr(latest);
    const created = await this.codes.create(tenantId, outletId, tableId, this.fresh(), origin);
    if (created) return this.toQr(created);
    // Someone else made it a moment earlier.
    return this.get(tenantId, outletId, tableId);
  }

  /** A new QR for the table; every QR printed before stops working now. */
  async rotate(tenantId: string, outletId: string, tableId: string, origin: CommandOrigin) {
    const rotated = await this.codes.rotate(
      tenantId,
      outletId,
      tableId,
      this.fresh(),
      new Date(),
      origin,
    );
    if (!rotated) throw qrNotActive();
    return this.toQr(rotated);
  }

  async revoke(tenantId: string, outletId: string, tableId: string, origin: CommandOrigin) {
    const revoked = await this.codes.revoke(tenantId, outletId, tableId, new Date(), origin);
    if (!revoked) throw qrNotActive();
    return this.toQr(revoked);
  }

  /**
   * What a guest's scan leads to. An unknown, rotated, or revoked token is
   * INVALID; a table or outlet that does not take orders now is CLOSED.
   */
  async resolve(token: string): Promise<PublicQrResolution> {
    return (await this.target(token)).resolution;
  }

  /** The resolution, and for the server only, the table it leads to. */
  async target(token: string) {
    if (!isQrToken(token)) return { resolution: invalid(), target: null };
    const target = await this.codes.resolve(hashQrToken(token));
    if (!target) return { resolution: invalid(), target: null };
    const access = await this.entitlements.describeAccess(target.tenantId, MODULES.tableSelfOrder);
    const open =
      access.subscriptionUsable &&
      access.module?.entitled === true &&
      access.installation === "ACTIVE" &&
      target.outletActive &&
      target.tableActive &&
      target.qrOrdering;
    const resolution = publicQrResolutionSchema.parse({
      merchantName: target.brandName,
      message: null,
      outletName: target.outletName,
      status: open ? "READY" : "CLOSED",
      tableLabel: target.tableLabel,
    });
    return { resolution, target };
  }

  private fresh() {
    const salt = newQrSalt();
    return { salt, tokenHash: hashQrToken(qrTokenOf(this.secret, salt)) };
  }

  private toQr(token: QrTokenRecord | null) {
    if (!token) return tableQrSchema.parse({ status: "NOT_GENERATED", url: null, version: null });
    const active = token.status === "ACTIVE";
    return tableQrSchema.parse({
      status: active ? "ACTIVE" : "REVOKED",
      url: active ? tableQrUrl(this.webUrl, qrTokenOf(this.secret, token.salt)) : null,
      version: token.version,
    });
  }
}

function tableNotFound() {
  return new NotFoundException({ code: "FLOOR_TABLE_NOT_FOUND", message: "Table was not found." });
}

function qrNotActive() {
  return new NotFoundException({
    code: "TABLE_QR_NOT_ACTIVE",
    message: "This table has no working QR.",
  });
}
