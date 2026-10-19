import { ConflictException, Inject, Injectable } from "@nestjs/common";

import {
  TABLE_SESSION_REPOSITORY,
  type TableSessionRepository,
} from "./table-session.repository.js";

/** Read-only adapter for the order kernel; deliberately independent of orders/billing. */
@Injectable()
export class TableVisitGuard {
  constructor(
    @Inject(TABLE_SESSION_REPOSITORY) private readonly sessions: TableSessionRepository,
  ) {}

  async ensureOpen(tenantId: string, outletId: string, visitId: string) {
    const visit = await this.sessions.findSession(tenantId, outletId, visitId);
    if (!visit || visit.status === "CLOSED") {
      throw new ConflictException({
        code: "TABLE_SESSION_CLOSED",
        message: "This visit is closed.",
      });
    }
  }
}
