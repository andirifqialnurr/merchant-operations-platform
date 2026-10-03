import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { accessReasonOf, canRetry } from "./access-reason";

const here = dirname(fileURLToPath(import.meta.url));

test("each refusal code is shown as its own access state", () => {
  assert.equal(accessReasonOf({ code: "ENTITLEMENT_REQUIRED" }), "not-entitled");
  assert.equal(accessReasonOf({ code: "TIER_UPGRADE_REQUIRED" }), "tier-required");
  assert.equal(accessReasonOf({ code: "SUBSCRIPTION_SUSPENDED" }), "subscription-suspended");
  for (const code of ["PERMISSION_DENIED", "LOCATION_SCOPE_DENIED", "WORKSPACE_ACCESS_DENIED"]) {
    assert.equal(accessReasonOf({ code }), "permission-denied", code);
  }
});

test("an installation refusal is told apart by the installation's status", () => {
  const of = (installation?: string) =>
    accessReasonOf({
      code: "INSTALLATION_SETUP_REQUIRED",
      ...(installation ? { details: { installation } } : {}),
    });

  assert.equal(of("PROVISIONING"), "provisioning");
  assert.equal(of("SETUP_REQUIRED"), "setup-required");
  assert.equal(of("NOT_INSTALLED"), "setup-required");
  assert.equal(of("SUSPENDED"), "paused");
  assert.equal(of("ERROR"), "paused");
  assert.equal(of(), "setup-required");
});

test("errors that are not about access stay ordinary errors", () => {
  assert.equal(accessReasonOf({ code: "POS_SHIFT_NOT_OPEN" }), undefined);
  assert.equal(accessReasonOf({ code: "API_REQUEST_FAILED" }), undefined);
  // A reached limit has its own state (usage and limit), not an access state.
  assert.equal(accessReasonOf({ code: "LIMIT_REACHED" }), undefined);
});

test("retry is offered only where waiting can help", () => {
  assert.equal(canRetry("provisioning"), true);
  assert.equal(canRetry("paused"), true);
  assert.equal(canRetry("permission-denied"), false);
  assert.equal(canRetry("not-entitled"), false);
});

test("every access state has a title in both languages", () => {
  const reasons = [
    "not-entitled",
    "tier-required",
    "provisioning",
    "setup-required",
    "paused",
    "permission-denied",
    "subscription-suspended",
  ];
  for (const locale of ["id", "en"]) {
    const { access } = JSON.parse(
      readFileSync(join(here, "..", "..", "messages", `${locale}.json`), "utf8"),
    ) as { access: { title: Record<string, string> } };
    assert.deepEqual(Object.keys(access.title).sort(), [...reasons].sort(), locale);
  }
});
