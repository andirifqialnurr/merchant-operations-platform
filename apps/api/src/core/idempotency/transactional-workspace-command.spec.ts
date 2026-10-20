import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { runTransactionalWorkspaceCommand } from "./transactional-workspace-command.js";

test("transactional workspace commands validate all reservation metadata before touching a client", async () => {
  let reads = 0;
  const transaction = new Proxy(
    {},
    {
      get() {
        reads += 1;
        throw new Error("Unexpected client access");
      },
    },
  ) as unknown as Parameters<typeof runTransactionalWorkspaceCommand>[0];
  const request = {
    tenantId: randomUUID(),
    key: "unit-request-00001",
    scope: "inventory.unit.create:actor",
    requestHash: "a".repeat(64),
    responseStatus: 201,
  };
  for (const invalid of [
    { tenantId: undefined },
    { tenantId: "" },
    { key: "short" },
    { scope: undefined },
    { scope: "" },
    { scope: "x".repeat(121) },
    { scope: "not a scope" },
    { requestHash: undefined },
    { requestHash: "" },
    { responseStatus: 500 },
    { responseStatus: 201.5 },
  ]) {
    await assert.rejects(
      runTransactionalWorkspaceCommand(
        transaction,
        { ...request, ...invalid } as typeof request,
        (value) => value,
        async () => ({}),
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(
          error.name === "ZodError" ||
            error.message === "Invalid transactional workspace command metadata.",
        );
        return true;
      },
    );
  }
  assert.equal(reads, 0);
});
