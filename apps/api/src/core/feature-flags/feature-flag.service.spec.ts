import assert from "node:assert/strict";
import test from "node:test";

import { featureEnabled } from "./feature-flag.service.js";

const workspace = "019f738d-e61f-7d46-92de-17b35f973004";

test("flags default closed and the global kill switch overrides workspace rollout", () => {
  assert.equal(featureEnabled(null, "pos.pilot", workspace), false);
  assert.equal(featureEnabled({ status: "ENABLED", rollout: {} }, "pos.pilot", workspace), false);
  assert.equal(
    featureEnabled(
      { status: "DISABLED", rollout: { percentage: 100, workspaceIds: [workspace] } },
      "pos.pilot",
      workspace,
    ),
    false,
  );
  assert.equal(
    featureEnabled(
      { status: "ENABLED", rollout: { workspaceIds: [workspace] } },
      "pos.pilot",
      workspace,
    ),
    true,
  );
  assert.equal(
    featureEnabled(
      { status: "ENABLED", rollout: { workspaceIds: [workspace] } },
      "pos.pilot",
      "another-workspace",
    ),
    false,
  );
});

test("percentage rollout is stable with exact closed/open endpoints", () => {
  for (let index = 0; index < 100; index += 1) {
    const id = `workspace-${index}`;
    const flag = { status: "ENABLED", rollout: { percentage: 50 } };
    assert.equal(featureEnabled(flag, "pos.pilot", id), featureEnabled(flag, "pos.pilot", id));
    assert.equal(featureEnabled({ ...flag, rollout: { percentage: 0 } }, "pos.pilot", id), false);
    assert.equal(featureEnabled({ ...flag, rollout: { percentage: 100 } }, "pos.pilot", id), true);
  }
});

test("invalid rollout cannot accidentally enable a feature", () => {
  for (const rollout of [
    null,
    [],
    "all",
    { percentage: "100" },
    { percentage: null, workspaceIds: [workspace] },
    { percentage: 100, workspaceIds: null },
    { percentage: 101 },
    { percentage: -1 },
    { percentage: 0.5 },
    { workspaceIds: [1] },
    { workspaceIds: ["invalid"] },
    { percentage: 100, unknown: true },
  ]) {
    assert.equal(featureEnabled({ status: "ENABLED", rollout }, "pos.pilot", workspace), false);
  }
});
