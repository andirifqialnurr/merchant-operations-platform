import type { ServiceRequestType } from "@merchant/contracts";

import type { ActorCommandOrigin, CommandOrigin } from "../../../shared/command/command-origin.js";

export type ServiceRequestRecord = {
  id: string;
  requestedAt: Date;
  sessionId: string;
  type: ServiceRequestType;
};

/**
 * Where guests' requests for staff are kept. A visit has at most one open
 * request of each type; the database keeps it so, so asking twice while
 * waiting leaves the first request as it was.
 */
export interface ServiceRequestRepository {
  /** The open request of this type for the visit, made now unless one is already open. */
  ask(
    tenantId: string,
    outletId: string,
    sessionId: string,
    type: ServiceRequestType,
    origin: CommandOrigin,
  ): Promise<ServiceRequestRecord>;
  /** Marks an open request done; null when it is not open (any more). */
  done(
    tenantId: string,
    outletId: string,
    id: string,
    now: Date,
    origin: ActorCommandOrigin,
  ): Promise<ServiceRequestRecord | null>;
  /** Open requests of visits still at their tables, oldest first. */
  openAt(tenantId: string, outletId: string): Promise<ServiceRequestRecord[]>;
  /** The types still open for one visit. */
  openFor(tenantId: string, sessionId: string): Promise<ServiceRequestType[]>;
}

export const SERVICE_REQUEST_REPOSITORY = Symbol("SERVICE_REQUEST_REPOSITORY");
