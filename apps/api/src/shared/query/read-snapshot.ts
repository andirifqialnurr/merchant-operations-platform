/** Opaque, in-process capability. It never comes from an HTTP header/body or leaves the query. */
export type ReadSnapshot = Readonly<{
  tenantId: string;
  outletId: string;
  lifetime: symbol;
}>;

export type ReadScope = Pick<ReadSnapshot, "tenantId" | "outletId">;

export interface ReadSnapshots {
  run<T>(scope: ReadScope, read: (snapshot: ReadSnapshot) => Promise<T>): Promise<T>;
}

export const READ_SNAPSHOTS = Symbol("READ_SNAPSHOTS");
