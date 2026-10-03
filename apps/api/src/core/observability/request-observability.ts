import { API_HEADERS } from "@merchant/contracts";

export type StructuredLogEntry = {
  level: "error" | "info";
  event: "api_exception" | "http_request_completed";
  requestId: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  errorName?: string;
  errorMessage?: string;
};

export type StructuredLogger = (entry: StructuredLogEntry) => void;

type MiddlewareRequest = {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  url?: string;
};

type MiddlewareResponse = {
  once?(event: "finish", listener: () => void): unknown;
  setHeader(name: string, value: string): void;
  statusCode?: number;
};

type NextFunction = () => void;

type ObservabilityOptions = {
  logger?: StructuredLogger;
  now?: () => number;
};

export function getRequestId(request: Pick<MiddlewareRequest, "headers">) {
  const header = request.headers?.[API_HEADERS.requestId];
  return typeof header === "string" && header.trim().length > 0
    ? header.slice(0, 100)
    : `req_${crypto.randomUUID()}`;
}

export function createRequestObservabilityMiddleware(options: ObservabilityOptions = {}) {
  const logger = options.logger ?? defaultStructuredLogger;
  const now = options.now ?? Date.now;

  return (request: MiddlewareRequest, response: MiddlewareResponse, next: NextFunction) => {
    const start = now();
    const requestId = getRequestId(request);

    request.headers = {
      ...request.headers,
      [API_HEADERS.requestId]: requestId,
    };
    response.setHeader(API_HEADERS.requestId, requestId);

    response.once?.("finish", () => {
      logger({
        level: "info",
        event: "http_request_completed",
        requestId,
        ...(request.method ? { method: request.method.toUpperCase() } : {}),
        path: sanitizePath(request.originalUrl ?? request.url),
        statusCode: response.statusCode ?? 0,
        durationMs: Math.max(now() - start, 0),
      });
    });

    next();
  };
}

export function buildErrorTrackingEvent(input: {
  requestId: string;
  method?: string;
  path?: string;
  statusCode: number;
  exception: unknown;
}): StructuredLogEntry {
  const error =
    input.exception instanceof Error
      ? input.exception
      : new Error(typeof input.exception === "string" ? input.exception : "Unknown API exception");

  return {
    level: "error",
    event: "api_exception",
    requestId: input.requestId,
    ...(input.method ? { method: input.method.toUpperCase() } : {}),
    path: sanitizePath(input.path),
    statusCode: input.statusCode,
    errorName: error.name,
    errorMessage: error.message,
  };
}

export function defaultStructuredLogger(entry: StructuredLogEntry) {
  const line = JSON.stringify(entry);

  if (entry.level === "error") {
    console.error(line);
    return;
  }

  console.info(line);
}

function sanitizePath(path: string | undefined) {
  return path?.split("?")[0] ?? "/";
}
