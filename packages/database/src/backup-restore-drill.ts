import { pathToFileURL } from "node:url";

export type DrillCommand = {
  command: "pg_dump" | "pg_restore";
  args: string[];
  env: {
    PGPASSWORD?: string;
  };
};

export type BackupRestoreDrill = {
  sourceDatabase: string;
  restoreDatabase: string;
  backupFile: string;
  redactedDatabaseUrl: string;
  pgDump: DrillCommand;
  pgRestore: DrillCommand;
};

export type BackupRestoreDrillInput = {
  databaseUrl: string;
  restoreDatabaseName: string;
  backupDirectory?: string;
  timestamp?: Date;
};

export function redactConnectionString(connectionString: string) {
  const parsed = parsePostgresUrl(connectionString);

  if (!parsed.password) {
    return parsed.toString();
  }

  return parsed.toString().replace(`:${parsed.password}@`, ":<redacted>@");
}

export function buildBackupRestoreDrill(input: BackupRestoreDrillInput): BackupRestoreDrill {
  const parsed = parsePostgresUrl(input.databaseUrl);
  const sourceDatabase = databaseNameFromPath(parsed.pathname);
  const restoreDatabase = input.restoreDatabaseName.trim();

  if (!restoreDatabase) {
    throw new Error("Restore target database is required.");
  }

  if (restoreDatabase === sourceDatabase) {
    throw new Error("Restore target database must differ from source database.");
  }

  const backupDirectory = input.backupDirectory ?? ".local/backups";
  const backupFile = `${backupDirectory}/${sanitizeFileSegment(sourceDatabase)}-${formatTimestamp(input.timestamp ?? new Date())}.dump`;
  const baseConnectionArgs = [
    `--host=${parsed.hostname}`,
    `--port=${parsed.port || "5432"}`,
    `--username=${decodeURIComponent(parsed.username)}`,
  ];
  const env = parsed.password ? { PGPASSWORD: decodeURIComponent(parsed.password) } : {};

  return {
    sourceDatabase,
    restoreDatabase,
    backupFile,
    redactedDatabaseUrl: redactConnectionString(input.databaseUrl),
    pgDump: {
      command: "pg_dump",
      args: [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        ...baseConnectionArgs,
        `--dbname=${sourceDatabase}`,
        `--file=${backupFile}`,
      ],
      env,
    },
    pgRestore: {
      command: "pg_restore",
      args: [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        ...baseConnectionArgs,
        `--dbname=${restoreDatabase}`,
        backupFile,
      ],
      env,
    },
  };
}

function parsePostgresUrl(connectionString: string) {
  const parsed = new URL(connectionString);

  if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol.");
  }

  if (!parsed.hostname || !parsed.username || !parsed.pathname) {
    throw new Error("DATABASE_URL must include host, username, and database name.");
  }

  return parsed;
}

function databaseNameFromPath(pathname: string) {
  const databaseName = decodeURIComponent(pathname.replace(/^\//, ""));

  if (!databaseName) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  return databaseName;
}

function sanitizeFileSegment(value: string) {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_");
}

function formatTimestamp(timestamp: Date) {
  return timestamp
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function shellLine(command: DrillCommand) {
  return [command.command, ...command.args].join(" ");
}

function printDrillPlan() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL wajib tersedia untuk membuat backup/restore drill.");
  }

  const drill = buildBackupRestoreDrill({
    databaseUrl,
    restoreDatabaseName:
      process.env.DATABASE_RESTORE_DRILL_DB ?? "merchant_operations_restore_drill",
  });

  console.info(`Source: ${drill.redactedDatabaseUrl}`);
  console.info(`Backup file: ${drill.backupFile}`);
  console.info(`Backup command: ${shellLine(drill.pgDump)}`);
  console.info(`Restore command: ${shellLine(drill.pgRestore)}`);
  console.info(
    "Set PGPASSWORD from DATABASE_URL in the process environment; do not paste it into shell history.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  printDrillPlan();
}
