import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { getPrismaClient } from "@merchant/database";

import { withDisposablePostgres } from "../../../packages/database/test/disposable-postgres.mjs";
import { FeatureFlagService } from "../src/core/feature-flags/feature-flag.service.ts";

test("feature flag storage enforces status and uses workspace rollout without caching stale decisions", async () => {
  await withDisposablePostgres(async ({ connectionString, database }) => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = connectionString;
    const db = getPrismaClient();
    try {
      const flags = new FeatureFlagService();
      const workspace = "019f738d-e61f-7d46-92de-17b35f973004";
      assert.equal(await flags.enabled("pos.pilot", workspace), false);
      await database.query(
        "INSERT INTO core_feature_flags (key, status, rollout) VALUES ($1, $2, $3)",
        ["pos.pilot", "ENABLED", JSON.stringify({ workspaceIds: [workspace] })],
      );
      assert.equal(await flags.enabled("pos.pilot", workspace), true);
      assert.equal(await flags.enabled("pos.pilot", "019f738d-e61f-7d46-92de-17b35f973005"), false);
      await database.query(
        "UPDATE core_feature_flags SET status = 'DISABLED' WHERE key = 'pos.pilot'",
      );
      assert.equal(await flags.enabled("pos.pilot", workspace), false);
      await assert.rejects(database.query("UPDATE core_feature_flags SET status = 'TYPO'"), {
        code: "23514",
      });
      await assert.rejects(database.query("UPDATE core_feature_flags SET rollout = '[]'"), {
        code: "23514",
      });
    } finally {
      await db.$disconnect();
      delete globalThis.prisma;
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
