import assert from "node:assert/strict";
import test from "node:test";

import { API_HEADERS, apiErrorSchema } from "@merchant/contracts";

import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { PLATFORM_SESSION_COOKIE_NAME } from "../platform/platform-session-cookie.js";
import {
  createCsrfProtectionMiddleware,
  createSecurityHeadersMiddleware,
  CSRF_HEADER_NAME,
} from "./http-security.js";

type TestRequest = {
  headers: Record<string, string | string[] | undefined>;
  method: string;
};

function createResponse() {
  const headers = new Map<string, string>();
  let body: unknown;
  let statusCode = 200;

  return {
    json(value: unknown) {
      body = value;
      return this;
    },
    result() {
      return { body, headers, statusCode };
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
    },
    status(value: number) {
      statusCode = value;
      return this;
    },
  };
}

test("sets browser security headers on every response", () => {
  const response = createResponse();
  let nextCalled = false;

  createSecurityHeadersMiddleware()({ headers: {}, method: "GET" }, response, () => {
    nextCalled = true;
  });

  const result = response.result();
  assert.equal(nextCalled, true);
  assert.equal(result.headers.get("x-content-type-options"), "nosniff");
  assert.equal(result.headers.get("x-frame-options"), "DENY");
  assert.equal(result.headers.get("referrer-policy"), "no-referrer");
  assert.equal(result.headers.get("cross-origin-opener-policy"), "same-origin");
  assert.equal(result.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.equal(
    result.headers.get("permissions-policy"),
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
});

test("requires a csrf header for unsafe requests that carry a session cookie", () => {
  const middleware = createCsrfProtectionMiddleware();
  const blockedResponse = createResponse();
  let blockedNextCalled = false;

  middleware(
    {
      headers: {
        [API_HEADERS.requestId]: "req_csrf_missing",
        cookie: `${SESSION_COOKIE_NAME}=${"a".repeat(43)}`,
      },
      method: "POST",
    },
    blockedResponse,
    () => {
      blockedNextCalled = true;
    },
  );

  const blocked = blockedResponse.result();
  assert.equal(blockedNextCalled, false);
  assert.equal(blocked.statusCode, 403);
  assert.equal(blocked.headers.get(API_HEADERS.requestId), "req_csrf_missing");
  assert.equal(apiErrorSchema.parse(blocked.body).code, "CSRF_TOKEN_REQUIRED");

  const allowedResponse = createResponse();
  let allowedNextCalled = false;
  middleware(
    {
      headers: {
        [CSRF_HEADER_NAME]: "csrf_01JZ8X4VYAT7Y0G4E5JD2Y6D9M",
        cookie: `${PLATFORM_SESSION_COOKIE_NAME}=${"b".repeat(43)}`,
      },
      method: "PATCH",
    },
    allowedResponse,
    () => {
      allowedNextCalled = true;
    },
  );

  assert.equal(allowedNextCalled, true);
  assert.equal(allowedResponse.result().body, undefined);
});

test("does not require csrf for safe requests or unauthenticated login requests", () => {
  const middleware = createCsrfProtectionMiddleware();

  for (const request of [
    { headers: { cookie: `${SESSION_COOKIE_NAME}=${"a".repeat(43)}` }, method: "GET" },
    { headers: {}, method: "POST" },
  ] satisfies TestRequest[]) {
    const response = createResponse();
    let nextCalled = false;

    middleware(request, response, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(response.result().body, undefined);
  }
});
