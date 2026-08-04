import { API_HEADERS, apiErrorSchema } from "@merchant/contracts";

import { getRequestId } from "../api-exception.filter.js";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { PLATFORM_SESSION_COOKIE_NAME } from "../platform/platform-session-cookie.js";

type MiddlewareRequest = {
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
};

type MiddlewareResponse = {
  json(body: unknown): unknown;
  setHeader(name: string, value: string): void;
  status(statusCode: number): MiddlewareResponse;
};

type NextFunction = () => void;

type SecurityEnvironment = {
  NODE_ENV?: string;
};

export const CSRF_HEADER_NAME = "x-csrf-token";

const UNSAFE_METHODS = new Set(["DELETE", "PATCH", "POST", "PUT"]);
const SESSION_COOKIE_NAMES = new Set([SESSION_COOKIE_NAME, PLATFORM_SESSION_COOKIE_NAME]);

function readHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string,
) {
  const value = headers?.[name];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function hasSessionCookie(cookieHeader: string | undefined) {
  if (!cookieHeader) {
    return false;
  }

  return cookieHeader.split(";").some((cookie) => {
    const separatorIndex = cookie.indexOf("=");
    return separatorIndex >= 0 && SESSION_COOKIE_NAMES.has(cookie.slice(0, separatorIndex).trim());
  });
}

function hasValidCsrfHeader(headers: Record<string, string | string[] | undefined> | undefined) {
  const value = readHeader(headers, CSRF_HEADER_NAME)?.trim();
  return Boolean(
    value && value.length >= 16 && value.length <= 255 && /^[A-Za-z0-9._:-]+$/.test(value),
  );
}

function writeCsrfError(request: MiddlewareRequest, response: MiddlewareResponse) {
  const requestId = getRequestId(request.headers ? { headers: request.headers } : {});
  response.setHeader(API_HEADERS.requestId, requestId);
  response.status(403).json(
    apiErrorSchema.parse({
      code: "CSRF_TOKEN_REQUIRED",
      message: "Token CSRF wajib dikirim untuk request session.",
      requestId,
    }),
  );
}

export function createSecurityHeadersMiddleware(environment: SecurityEnvironment = process.env) {
  return (_request: MiddlewareRequest, response: MiddlewareResponse, next: NextFunction) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    response.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=()",
    );

    if (environment.NODE_ENV === "production") {
      response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    next();
  };
}

export function createCsrfProtectionMiddleware() {
  return (request: MiddlewareRequest, response: MiddlewareResponse, next: NextFunction) => {
    const method = request.method?.toUpperCase() ?? "GET";
    const cookieHeader = readHeader(request.headers, "cookie");

    if (
      !UNSAFE_METHODS.has(method) ||
      !hasSessionCookie(cookieHeader) ||
      hasValidCsrfHeader(request.headers)
    ) {
      next();
      return;
    }

    writeCsrfError(request, response);
  };
}
