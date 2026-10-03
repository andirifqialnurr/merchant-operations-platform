import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import {
  buildErrorTrackingEvent,
  createRequestObservabilityMiddleware,
} from "./request-observability.js";

test("sets a request id response header and writes a structured completion log", () => {
  const logs: unknown[] = [];
  const response = new EventEmitter() as EventEmitter & {
    headers: Map<string, string>;
    setHeader(name: string, value: string): void;
    statusCode: number;
  };
  response.headers = new Map();
  response.statusCode = 201;
  response.setHeader = (name, value) => response.headers.set(name, value);
  const middleware = createRequestObservabilityMiddleware({
    now: (() => {
      const values = [1_000, 1_042];
      return () => values.shift() ?? 1_042;
    })(),
    logger: (entry) => logs.push(entry),
  });

  middleware(
    {
      headers: { "x-request-id": "req_client_supplied", authorization: "Bearer secret" },
      method: "POST",
      originalUrl: "/api/v1/catalog/products?token=secret",
    },
    response,
    () => undefined,
  );
  response.emit("finish");

  assert.equal(response.headers.get("x-request-id"), "req_client_supplied");
  assert.deepEqual(logs, [
    {
      level: "info",
      event: "http_request_completed",
      requestId: "req_client_supplied",
      method: "POST",
      path: "/api/v1/catalog/products",
      statusCode: 201,
      durationMs: 42,
    },
  ]);
});

test("generates a bounded request id when the caller did not provide one", () => {
  const logs: unknown[] = [];
  const response = new EventEmitter() as EventEmitter & {
    headers: Map<string, string>;
    setHeader(name: string, value: string): void;
    statusCode: number;
  };
  response.headers = new Map();
  response.statusCode = 200;
  response.setHeader = (name, value) => response.headers.set(name, value);

  createRequestObservabilityMiddleware({ logger: (entry) => logs.push(entry) })(
    { headers: {}, method: "GET", originalUrl: "/health" },
    response,
    () => undefined,
  );

  const requestId = response.headers.get("x-request-id");
  assert.match(requestId ?? "", /^req_[0-9a-f-]{36}$/);
});

test("builds an error tracking event with stable fields and no stack trace", () => {
  const event = buildErrorTrackingEvent({
    requestId: "req_error",
    method: "PATCH",
    path: "/api/v1/platform/tenants",
    statusCode: 500,
    exception: new Error("database unavailable"),
  });

  assert.deepEqual(event, {
    level: "error",
    event: "api_exception",
    requestId: "req_error",
    method: "PATCH",
    path: "/api/v1/platform/tenants",
    statusCode: 500,
    errorName: "Error",
    errorMessage: "database unavailable",
  });
});
