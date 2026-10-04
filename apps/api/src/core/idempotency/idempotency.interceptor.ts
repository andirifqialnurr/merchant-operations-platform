import { createHash } from "node:crypto";

import { API_HEADERS, idempotencyKeySchema, type AuthorizationContext } from "@merchant/contracts";
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UseInterceptors,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import { defer, lastValueFrom } from "rxjs";

import {
  PrismaIdempotencyRepository,
  type IdempotencyRepository,
} from "./idempotency.repository.js";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function requestHash(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

const conflict = (code: string, message: string) => new ConflictException({ code, message });

type AuthorizedRequest = {
  accessContext?: AuthorizationContext;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  params?: unknown;
  query?: unknown;
};

/** Guards run first on every attempt, including replay. JSON responses only. */
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly repository: IdempotencyRepository = new PrismaIdempotencyRepository(),
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    return defer(async () => {
      const request = context.switchToHttp().getRequest<AuthorizedRequest>();
      const response = context
        .switchToHttp()
        .getResponse<{ statusCode: number; status: (code: number) => void }>();
      const access = request.accessContext;
      if (!access)
        throw new InternalServerErrorException("Idempotent routes require SessionPermissionGuard.");
      const key = idempotencyKeySchema.safeParse(request.headers[API_HEADERS.idempotencyKey]);
      if (!key.success)
        throw new BadRequestException({
          code: "IDEMPOTENCY_KEY_REQUIRED",
          message: "A valid Idempotency-Key header is required.",
        });
      const scope = `http:${context.getClass().name}.${context.getHandler().name}`;
      if (scope.length > 120)
        throw new InternalServerErrorException("Idempotency scope exceeds its storage limit.");
      const hash = requestHash({
        actor: access.userId,
        device: access.deviceId ?? null,
        method: request.method,
        params: request.params,
        query: request.query,
        body: request.body,
      });
      const outlet = request.headers[API_HEADERS.outletId];
      const { created, record } = await this.repository.reserve({
        tenantId: access.tenantId,
        outletId: typeof outlet === "string" ? outlet : null,
        scope,
        key: key.data,
        requestHash: hash,
      });
      if (!created) {
        if (record.requestHash !== hash)
          throw conflict(
            "IDEMPOTENCY_KEY_REUSED",
            "The key was already used for a different request.",
          );
        // Uncertain outcomes stay reserved, even past expiry: never repeat a
        // write just because the worker died before its response was saved.
        if (record.status === "PENDING")
          throw conflict(
            "IDEMPOTENCY_IN_PROGRESS",
            "This request is still processing or awaiting recovery.",
          );
        if (record.status === "FAILED")
          throw conflict(
            "IDEMPOTENCY_FAILED",
            "The earlier request failed. Check its outcome before sending a new request.",
          );
        if (record.expiresAt <= new Date())
          throw conflict("IDEMPOTENCY_EXPIRED", "This response is no longer available for replay.");
        if (record.responseStatus === null)
          throw new InternalServerErrorException("The saved response is incomplete.");
        response.status(record.responseStatus);
        return record.responseBody;
      }
      try {
        const body: unknown = await lastValueFrom(next.handle());
        await this.repository.complete(record.id, response.statusCode, body);
        return body;
      } catch (error) {
        // If even marking failure is unavailable, PENDING still blocks replay.
        await this.repository.fail(record.id).catch(() => undefined);
        throw error;
      }
    });
  }
}

/** Do not apply to secret-bearing responses or endpoints with their own domain key. */
export const Idempotent = () => UseInterceptors(new IdempotencyInterceptor());
