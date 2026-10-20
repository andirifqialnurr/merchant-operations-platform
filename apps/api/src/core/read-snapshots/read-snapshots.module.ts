import { Module } from "@nestjs/common";

import { READ_SNAPSHOTS } from "../../shared/query/read-snapshot.js";
import { PrismaReadSnapshots } from "./adapters/prisma-read-snapshots.js";

/** Technical read consistency, not a new product module or a domain-data owner. */
@Module({
  exports: [READ_SNAPSHOTS],
  providers: [PrismaReadSnapshots, { provide: READ_SNAPSHOTS, useExisting: PrismaReadSnapshots }],
})
export class ReadSnapshotsModule {}
