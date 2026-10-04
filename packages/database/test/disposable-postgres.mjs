import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import process from "node:process";
import { URL } from "node:url";

import pg from "pg";

/**
 * The supplied URL is used ONLY to create/drop a uniquely named test database.
 * Migration SQL and the callback never run on the supplied database. A new
 * database for each suite also exercises every migration from an empty schema.
 */
export async function withDisposablePostgres(run) {
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!adminUrl)
    throw new Error("Set TEST_DATABASE_ADMIN_URL or DATABASE_URL for PostgreSQL tests.");
  const name = `merchant_test_${randomUUID().replaceAll("-", "")}`;
  const testUrl = new URL(adminUrl);
  testUrl.pathname = `/${name}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  let created = false;
  let database;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    database = new pg.Client({ connectionString: testUrl.href });
    await database.connect();
    const actual = await database.query("SELECT current_database() AS name");
    if (actual.rows[0].name !== name) throw new Error("Disposable database identity mismatch.");
    const migrations = new URL("../prisma/migrations/", import.meta.url);
    const directories = (await readdir(migrations, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const directory of directories) {
      const sql = await readFile(new URL(`${directory}/migration.sql`, migrations), "utf8");
      await database.query(sql);
    }
    await run({ connectionString: testUrl.href, database, name });
  } finally {
    await database?.end();
    try {
      // Both ownership (created by this invocation) and the generated name are
      // checked before dropping anything. No URL-supplied name reaches DROP.
      if (created && /^merchant_test_[a-f0-9]{32}$/.test(name)) {
        await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
      }
    } finally {
      await admin.end();
    }
  }
}
