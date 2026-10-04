import assert from "node:assert/strict";
import test from "node:test";

import { type AuthorizationContext } from "@merchant/contracts";
import { HttpException, type ExecutionContext } from "@nestjs/common";
import { defer, lastValueFrom, of } from "rxjs";

import { IdempotencyInterceptor, requestHash } from "./idempotency.interceptor.js";
import type {
  IdempotencyRecord,
  IdempotencyRepository,
  IdempotencyRequest,
} from "./idempotency.repository.js";

class MemoryRepository implements IdempotencyRepository {
  rows = new Map<string, IdempotencyRecord>();
  async reserve(request: IdempotencyRequest) {
    const id = JSON.stringify([request.tenantId, request.outletId, request.scope, request.key]);
    const existing = this.rows.get(id);
    if (existing) return { created: false, record: existing };
    const record: IdempotencyRecord = {
      id,
      expiresAt: new Date(Date.now() + 60_000),
      requestHash: request.requestHash,
      responseBody: null,
      responseStatus: null,
      status: "PENDING",
    };
    this.rows.set(id, record);
    return { created: true, record };
  }
  async complete(id: string, responseStatus: number, responseBody: unknown) {
    Object.assign(this.rows.get(id)!, { responseBody, responseStatus, status: "COMPLETED" });
  }
  async fail(id: string) {
    this.rows.get(id)!.status = "FAILED";
  }
}

class Routes {
  write() {}
}
const access: AuthorizationContext = {
  allOutlets: true,
  membershipId: "member",
  outletIds: [],
  permissionKeys: [],
  tenantId: "workspace-a",
  userId: "owner",
};
function request(overrides: Record<string, unknown> = {}) {
  return {
    accessContext: access,
    body: { name: "Example" },
    headers: { "idempotency-key": "request-key-123456" },
    method: "POST",
    params: { id: "binding" },
    query: {},
    ...overrides,
  };
}
function context(req = request()) {
  const response = {
    statusCode: 201,
    status(code: number) {
      this.statusCode = code;
    },
  };
  return {
    response,
    context: {
      getClass: () => Routes,
      getHandler: () => Routes.prototype.write,
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => response }),
    } as unknown as ExecutionContext,
  };
}
const hasCode = (code: string) => (error: unknown) =>
  error instanceof HttpException && (error.getResponse() as { code: string }).code === code;

test("JSON key order is irrelevant but changed nested values and array order are not", () => {
  assert.equal(requestHash({ a: 1, b: { x: 2, y: 3 } }), requestHash({ b: { y: 3, x: 2 }, a: 1 }));
  assert.notEqual(requestHash([1, 2]), requestHash([2, 1]));
  assert.notEqual(requestHash({ a: { x: 1 } }), requestHash({ a: { x: 2 } }));
});

test("replay returns the first status and body without calling the handler twice", async () => {
  const repository = new MemoryRepository();
  const interceptor = new IdempotencyInterceptor(repository);
  let calls = 0;
  const next = {
    handle: () => {
      calls += 1;
      return of({ saved: true });
    },
  };
  const first = context();
  const repeated = context();
  repeated.response.statusCode = 200;
  assert.deepEqual(await lastValueFrom(interceptor.intercept(first.context, next)), {
    saved: true,
  });
  assert.deepEqual(await lastValueFrom(interceptor.intercept(repeated.context, next)), {
    saved: true,
  });
  assert.equal(repeated.response.statusCode, 201);
  assert.equal(calls, 1);
  await assert.rejects(
    lastValueFrom(
      interceptor.intercept(context(request({ body: { name: "Changed" } })).context, next),
    ),
    hasCode("IDEMPOTENCY_KEY_REUSED"),
  );
  await assert.rejects(
    lastValueFrom(
      interceptor.intercept(
        context(request({ accessContext: { ...access, userId: "another-owner" } })).context,
        next,
      ),
    ),
    hasCode("IDEMPOTENCY_KEY_REUSED"),
  );
  await lastValueFrom(
    interceptor.intercept(
      context(request({ accessContext: { ...access, tenantId: "workspace-b" } })).context,
      next,
    ),
  );
  assert.equal(calls, 2, "another workspace has its own key space");
});

test("an in-flight duplicate and a crashed or expired result never repeat a write", async () => {
  const repository = new MemoryRepository();
  const interceptor = new IdempotencyInterceptor(repository);
  let finish!: (value: { saved: boolean }) => void;
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<{ saved: boolean }>((resolve) => {
    finish = resolve;
  });
  const first = lastValueFrom(
    interceptor.intercept(context().context, {
      handle: () => {
        started();
        return defer(() => pending);
      },
    }),
  );
  await entered;
  const neverRun = {
    handle: () => {
      throw new Error("Duplicate mutation executed");
    },
  };
  await assert.rejects(
    lastValueFrom(interceptor.intercept(context().context, neverRun)),
    hasCode("IDEMPOTENCY_IN_PROGRESS"),
  );
  finish({ saved: true });
  await first;
  const row = [...repository.rows.values()][0]!;
  row.expiresAt = new Date(0);
  await assert.rejects(
    lastValueFrom(interceptor.intercept(context().context, neverRun)),
    hasCode("IDEMPOTENCY_EXPIRED"),
  );
  row.status = "PENDING";
  await assert.rejects(
    lastValueFrom(interceptor.intercept(context().context, neverRun)),
    hasCode("IDEMPOTENCY_IN_PROGRESS"),
  );
  row.status = "FAILED";
  await assert.rejects(
    lastValueFrom(interceptor.intercept(context().context, neverRun)),
    hasCode("IDEMPOTENCY_FAILED"),
  );
});

test("a handler failure is kept for recovery instead of automatically repeating an uncertain mutation", async () => {
  const repository = new MemoryRepository();
  const interceptor = new IdempotencyInterceptor(repository);
  const failure = new Error("Connection lost after write");
  await assert.rejects(
    lastValueFrom(
      interceptor.intercept(context().context, {
        handle: () => {
          throw failure;
        },
      }),
    ),
    failure,
  );
  assert.equal([...repository.rows.values()][0]!.status, "FAILED");
});

test("missing or invalid keys are rejected before reserving a row or calling the handler", async () => {
  const repository = new MemoryRepository();
  const interceptor = new IdempotencyInterceptor(repository);
  for (const key of [undefined, "short", ["request-key-123456", "other-key-123456"]]) {
    await assert.rejects(
      lastValueFrom(
        interceptor.intercept(context(request({ headers: { "idempotency-key": key } })).context, {
          handle: () => {
            throw new Error("Unexpected write");
          },
        }),
      ),
      hasCode("IDEMPOTENCY_KEY_REQUIRED"),
    );
  }
  assert.equal(repository.rows.size, 0);
});
