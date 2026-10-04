import { createHash } from "node:crypto";

import { getPrismaClient } from "@merchant/database";
import { Injectable } from "@nestjs/common";

export type FeatureFlag = { status: string; rollout: unknown };

/** Missing or malformed configuration is closed. Flags never grant permission. */
export function featureEnabled(flag: FeatureFlag | null, key: string, workspaceId: string) {
  if (!flag || flag.status !== "ENABLED") return false;
  const rollout = flag.rollout;
  if (!rollout || typeof rollout !== "object" || Array.isArray(rollout)) return false;
  const config = rollout as Record<string, unknown>;
  if (Object.keys(config).some((name) => !["percentage", "workspaceIds"].includes(name)))
    return false;
  const percentage = Object.hasOwn(config, "percentage") ? config.percentage : 0;
  if (
    typeof percentage !== "number" ||
    !Number.isInteger(percentage) ||
    percentage < 0 ||
    percentage > 100
  )
    return false;
  const ids = Object.hasOwn(config, "workspaceIds") ? config.workspaceIds : [];
  if (
    !Array.isArray(ids) ||
    !ids.every(
      (id) => typeof id === "string" && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id),
    )
  )
    return false;
  if (ids.includes(workspaceId)) return true;
  // Stable across instances and restarts; each feature has its own cohort.
  const bucket =
    createHash("sha256").update(`${key}:${workspaceId}`).digest().readUInt32BE(0) % 100;
  return bucket < percentage;
}

@Injectable()
export class FeatureFlagService {
  async enabled(key: string, workspaceId: string) {
    // No cache: the global kill switch takes effect on the next request.
    const rows = await getPrismaClient().$queryRaw<FeatureFlag[]>`
      SELECT status, rollout FROM core_feature_flags WHERE key = ${key}
    `;
    return featureEnabled(rows[0] ?? null, key, workspaceId);
  }
}
