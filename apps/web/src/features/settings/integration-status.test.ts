import assert from "node:assert/strict";
import test from "node:test";

import {
  integrationBindingHealthSchema,
  integrationBindingStatusSchema,
} from "@merchant/contracts";

import en from "../../../messages/en.json" with { type: "json" };
import id from "../../../messages/id.json" with { type: "json" };
import { canRetryIntegration, integrationState } from "./integration-status.ts";

test("status and health fold into the state a business owner reads", () => {
  assert.equal(integrationState({ health: "HEALTHY", status: "ACTIVE" }), "ACTIVE");
  assert.equal(integrationState({ health: "STALE", status: "ACTIVE" }), "PROCESSING");
  assert.equal(integrationState({ health: "BLOCKED", status: "ACTIVE" }), "FAILED");
  assert.equal(integrationState({ health: "BLOCKED", status: "ERROR" }), "FAILED");
  assert.equal(integrationState({ health: "HEALTHY", status: "SETUP_REQUIRED" }), "SETUP_REQUIRED");
  assert.equal(integrationState({ health: "HEALTHY", status: "DRAFT" }), "SETUP_REQUIRED");
  assert.equal(integrationState({ health: "BLOCKED", status: "PAUSED" }), "PAUSED");
});

test("an integration of a module that is no longer used is not listed", () => {
  for (const health of integrationBindingHealthSchema.options) {
    assert.equal(integrationState({ health, status: "DISABLED" }), undefined);
  }
});

test("only a failed integration offers to try again, and every state has words", () => {
  const states = new Set<string>();
  for (const status of integrationBindingStatusSchema.options) {
    for (const health of integrationBindingHealthSchema.options) {
      const state = integrationState({ health, status });
      if (!state) continue;
      states.add(state);
      assert.equal(canRetryIntegration(state), state === "FAILED");
    }
  }
  for (const dictionary of [id, en]) {
    for (const state of states) {
      assert.ok(dictionary.integrations.state[state as keyof typeof dictionary.integrations.state]);
      assert.ok(dictionary.integrations.hint[state as keyof typeof dictionary.integrations.hint]);
    }
  }
});
