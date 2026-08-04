import assert from "node:assert/strict";
import test from "node:test";

import { buildBackupRestoreDrill, redactConnectionString } from "./backup-restore-drill.ts";

const databaseUrl =
  "postgresql://merchant_user:super-secret@localhost:5432/merchant_operations?schema=public";

test("builds a backup and restore drill without leaking the database password into command args", () => {
  const drill = buildBackupRestoreDrill({
    databaseUrl,
    timestamp: new Date("2026-08-04T12:30:00.000Z"),
    restoreDatabaseName: "merchant_operations_restore_drill",
  });

  assert.equal(drill.backupFile, ".local/backups/merchant_operations-20260804T123000Z.dump");
  assert.deepEqual(drill.pgDump.args, [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--host=localhost",
    "--port=5432",
    "--username=merchant_user",
    "--dbname=merchant_operations",
    "--file=.local/backups/merchant_operations-20260804T123000Z.dump",
  ]);
  assert.deepEqual(drill.pgRestore.args, [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--host=localhost",
    "--port=5432",
    "--username=merchant_user",
    "--dbname=merchant_operations_restore_drill",
    ".local/backups/merchant_operations-20260804T123000Z.dump",
  ]);
  assert.equal(drill.pgDump.env.PGPASSWORD, "super-secret");
  assert.equal(drill.pgRestore.env.PGPASSWORD, "super-secret");
  assert.equal(JSON.stringify(drill.pgDump.args).includes("super-secret"), false);
  assert.equal(JSON.stringify(drill.pgRestore.args).includes("super-secret"), false);
});

test("requires a separate restore target database to avoid overwriting the source database", () => {
  assert.throws(
    () =>
      buildBackupRestoreDrill({
        databaseUrl,
        restoreDatabaseName: "merchant_operations",
      }),
    /restore target database must differ from source database/i,
  );
});

test("redacts postgres credentials for drill reports", () => {
  assert.equal(
    redactConnectionString(databaseUrl),
    "postgresql://merchant_user:<redacted>@localhost:5432/merchant_operations?schema=public",
  );
});
