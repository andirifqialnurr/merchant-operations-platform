import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { eventPayloadKeyKind, safeEventPayload } from "./event-payload.js";

test("facts by ID and by value pass through unchanged", () => {
  const payload = {
    completedAt: "2026-10-04T03:00:00.000Z",
    currency: "IDR",
    itemCount: 3,
    orderId: "019f738d-e61f-7d46-92de-17b35f976001",
    saleNumber: "S-0001",
    totalMinor: "45000",
  };
  assert.deepEqual(safeEventPayload(payload), payload);
});

test("dates and big numbers are stored as text", () => {
  assert.deepEqual(
    safeEventPayload({ at: new Date("2026-10-04T03:00:00.000Z"), totalMinor: 45000n }),
    { at: "2026-10-04T03:00:00.000Z", totalMinor: "45000" },
  );
});

test("a secret key fails the write, at any depth, without showing the value", () => {
  for (const payload of [
    { password: "hunter2-value" },
    { after: { credentialHash: "hunter2-value" } },
    { provider: { rawPayload: "hunter2-value" } },
    { items: [{ access_token: "hunter2-value" }] },
    { sessionId: "hunter2-value" },
    { webhookSignature: "hunter2-value" },
    { cashierPin: "hunter2-value" },
  ]) {
    assert.throws(
      () => safeEventPayload(payload),
      (error: Error) =>
        /Event payload key rejected \(secret\)/.test(error.message) &&
        !error.message.includes("hunter2-value"),
    );
  }
});

test("personal data fails the write: handlers read it from its owner by ID", () => {
  for (const key of [
    "email",
    "customerPhone",
    "customer_name",
    "fullName",
    "deliveryAddress",
    "birthDate",
    "nik",
    "npwp",
  ]) {
    assert.throws(
      () => safeEventPayload({ after: { [key]: "someone" } }),
      /Event payload key rejected \(personal\): after\./,
      key,
    );
  }
});

test("free text stays out of the event and the rest is kept", () => {
  assert.deepEqual(
    safeEventPayload({
      amountMinor: "10000",
      after: { notes: "Call Budi on 0812", status: "ACTIVE" },
      reason: "Customer Budi changed his mind",
      refundId: "r-1",
    }),
    { after: { status: "ACTIVE" }, amountMinor: "10000", refundId: "r-1" },
  );
});

test("ordinary business words are not mistaken for personal or secret ones", () => {
  for (const key of [
    "name",
    "objectKey",
    "permissionKeys",
    "pinnedAt",
    "shiftId",
    "moduleKey",
    "saleNumber",
    "description",
    "userId",
    "unikCode",
  ]) {
    assert.equal(eventPayloadKeyKind(key), "allowed", key);
  }
});

test("a value that cannot be stored as JSON is refused", () => {
  assert.throws(() => safeEventPayload({ run: () => undefined }), /Unsupported event payload/);
});

// ---- Guard: no code path may write an event payload around the check.

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts") ? [path] : [];
  });
}

test("every outbox payload in the code goes through safeEventPayload", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const unchecked: string[] = [];
  let payloads = 0;
  for (const file of sourceFiles(root)) {
    const text = readFileSync(file, "utf8");
    // The body of each outbox write, up to the end of its call.
    for (const match of text.matchAll(/outboxEvent\.create(?:Many)?\(\{[\s\S]*?\n\s*\}\);/g)) {
      const all = match[0].match(/\bpayload\b/g)?.length ?? 0;
      const checked = match[0].match(/payload: safeEventPayload\(/g)?.length ?? 0;
      payloads += checked;
      // Each "payload: safeEventPayload(payload)" mentions the word twice at most.
      const bare = match[0].match(/\bpayload(,|: (?!safeEventPayload\())/g)?.length ?? 0;
      if (all === 0 || bare > 0) unchecked.push(file);
    }
  }
  assert.ok(payloads >= 11, "the scan must find the outbox payloads");
  assert.deepEqual(unchecked, []);
});
