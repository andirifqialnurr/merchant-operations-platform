import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  API_HEADERS,
  requestContextHeadersSchema,
  tenantRequestHeadersSchema,
} from "@merchant/contracts";

import { commandOriginFromEvent, commandOriginFromRequest, eventOrigin } from "./command-origin.js";

const USER = "019f738d-e61f-7d46-92de-17b35f976001";
const DEVICE = "019f738d-e61f-7d46-92de-17b35f976002";
const EVENT = "019f738d-e61f-7d46-92de-17b35f976003";
const TENANT = "019f738d-e61f-7d46-92de-17b35f976004";

test("a request becomes an origin with the actor, the channel, the client, and the request ID", () => {
  const headers = tenantRequestHeadersSchema.parse({
    [API_HEADERS.clientChannel]: "WEB",
    [API_HEADERS.clientVersion]: "1.4.0",
    [API_HEADERS.requestId]: "web_abc",
    [API_HEADERS.tenantId]: TENANT,
  });
  assert.deepEqual(commandOriginFromRequest(USER, headers), {
    actorId: USER,
    channel: "WEB",
    clientVersion: "1.4.0",
    requestId: "web_abc",
  });
});

test("a client that does not say what it is counts as a plain API client", () => {
  const headers = tenantRequestHeadersSchema.parse({ [API_HEADERS.tenantId]: TENANT });
  assert.deepEqual(commandOriginFromRequest(USER, headers), { actorId: USER, channel: "API" });
});

test("an unknown channel or an oversized version is refused before any use case runs", () => {
  const base = { [API_HEADERS.outletId]: TENANT, [API_HEADERS.tenantId]: TENANT };
  assert.equal(
    requestContextHeadersSchema.safeParse({ ...base, [API_HEADERS.clientChannel]: "FAX" }).success,
    false,
  );
  assert.equal(
    requestContextHeadersSchema.safeParse({
      ...base,
      [API_HEADERS.clientVersion]: "x".repeat(81),
    }).success,
    false,
  );
});

test("an event carries the origin of the command that announced it", () => {
  assert.deepEqual(
    eventOrigin(
      { actorId: USER, channel: "POS", clientVersion: "1.4.0", requestId: "web_abc" },
      "CORE_ORDER",
    ),
    {
      actorId: USER,
      actorType: "USER",
      channel: "POS",
      clientVersion: "1.4.0",
      correlationId: "web_abc",
      producer: "CORE_ORDER",
    },
  );
  // Nobody asked: a job or a migration did it.
  assert.deepEqual(eventOrigin(undefined, "CORE_SUBSCRIPTION"), {
    actorType: "SYSTEM",
    producer: "CORE_SUBSCRIPTION",
  });
  // A person signed in on a device stays the actor; the device is recorded next to them.
  assert.deepEqual(eventOrigin({ actorId: USER, channel: "POS", deviceId: DEVICE }, "POS"), {
    actorId: USER,
    actorType: "USER",
    channel: "POS",
    deviceId: DEVICE,
    producer: "POS",
  });
  // With nobody signed in, the device itself is the actor.
  assert.deepEqual(eventOrigin({ channel: "KDS", deviceId: DEVICE }, "KDS"), {
    actorId: DEVICE,
    actorType: "DEVICE",
    channel: "KDS",
    deviceId: DEVICE,
    producer: "KDS",
  });
});

test("a command issued by an event handler is caused by that event and stays in its chain", () => {
  const origin = commandOriginFromEvent({
    channel: "POS",
    clientVersion: "1.4.0",
    correlationId: "web_abc",
    eventId: EVENT,
  });
  assert.deepEqual(origin, {
    causationId: EVENT,
    channel: "POS",
    clientVersion: "1.4.0",
    requestId: "web_abc",
  });
  // The handler acts as the system, and its events point back at the first one.
  assert.deepEqual(eventOrigin(origin, "KDS"), {
    actorType: "SYSTEM",
    causationId: EVENT,
    channel: "POS",
    clientVersion: "1.4.0",
    correlationId: "web_abc",
    producer: "KDS",
  });
  // An event from before the columns existed has nothing to pass on but itself.
  assert.deepEqual(
    commandOriginFromEvent({
      channel: null,
      clientVersion: null,
      correlationId: null,
      eventId: EVENT,
    }),
    { causationId: EVENT },
  );
});

// ---- Guard: no code path may write an event without its origin.

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts") ? [path] : [];
  });
}

test("every outbox write and every HTTP mutation context goes through the command origin", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const withoutOrigin: string[] = [];
  const handBuilt: string[] = [];
  let writes = 0;
  for (const file of sourceFiles(root)) {
    const text = readFileSync(file, "utf8");
    const creates = text.match(/outboxEvent\.create(Many)?\(/g)?.length ?? 0;
    if (creates > 0) {
      writes += creates;
      // createMany writes several events in one call; each needs its own origin.
      const origins = text.match(/\.\.\.eventOrigin\(/g)?.length ?? 0;
      if (origins < creates) withoutOrigin.push(file);
    }
    if (file.endsWith(".controller.ts") && /actorId: (access\.userId|user\.id)/.test(text)) {
      handBuilt.push(file);
    }
  }
  assert.ok(writes >= 10, "the scan must find the outbox writes");
  assert.deepEqual(withoutOrigin, []);
  assert.deepEqual(handBuilt, []);
});
