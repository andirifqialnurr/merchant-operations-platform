import {
  API_HEADERS,
  commonOpenApiSchemas,
  PLATFORM_PERMISSIONS,
  platformRequestHeadersSchema,
} from "@merchant/contracts";
import { BadRequestException, ForbiddenException, type INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";

import { getRequestId, mapExceptionToApiError } from "./api-exception.filter.js";
import { SESSION_COOKIE_NAME } from "./auth/session-cookie.js";
import { PlatformAuthService } from "./platform/platform-auth.service.js";
import {
  PLATFORM_SESSION_COOKIE_NAME,
  readPlatformSessionToken,
} from "./platform/platform-session-cookie.js";

type OpenApiSchemas = NonNullable<OpenAPIObject["components"]>["schemas"];
type OpenApiEnvironment = {
  API_DOCS_ENABLED?: string;
  NODE_ENV?: string;
};

type DocsRequest = {
  headers: Record<string, string | string[] | undefined>;
};

type DocsResponse = {
  json(body: unknown): unknown;
  setHeader(name: string, value: string): void;
  status(statusCode: number): DocsResponse;
};

type NextFunction = () => void;

export const OPENAPI_ROUTES = {
  json: "/api/openapi.json",
  ui: "/api/docs",
  yaml: "/api/openapi.yaml",
} as const;

export function isOpenApiEnabled(environment: OpenApiEnvironment = process.env) {
  if (environment.NODE_ENV === "production") {
    return environment.API_DOCS_ENABLED === "true";
  }

  return environment.API_DOCS_ENABLED !== "false";
}

export function isOpenApiPlatformAuthRequired(environment: OpenApiEnvironment = process.env) {
  return environment.NODE_ENV === "production";
}

function validationError(issues: { code: string; message: string; path: PropertyKey[] }[]) {
  return new BadRequestException({
    code: "VALIDATION_ERROR",
    details: { issues },
    message: "Request tidak valid.",
  });
}

export function createOpenApiAuthorizationMiddleware(authService: PlatformAuthService) {
  return async (request: DocsRequest, response: DocsResponse, next: NextFunction) => {
    const requestId = getRequestId(request);

    try {
      const parsedHeaders = platformRequestHeadersSchema.safeParse(request.headers);
      if (!parsedHeaders.success) {
        throw validationError(
          parsedHeaders.error.issues.map((issue) => ({
            code: issue.code,
            message: issue.message,
            path: issue.path,
          })),
        );
      }

      const cookie = request.headers.cookie;
      const cookieHeader = Array.isArray(cookie) ? cookie[0] : cookie;
      const session = await authService.getSession(readPlatformSessionToken(cookieHeader));
      if (!session.user.permissionKeys.includes(PLATFORM_PERMISSIONS.docsRead)) {
        throw new ForbiddenException({
          code: "PLATFORM_AUTHORIZATION_DENIED",
          message: "Anda tidak memiliki akses platform untuk dokumentasi API.",
        });
      }

      next();
    } catch (error) {
      const mapped = mapExceptionToApiError(error, requestId);
      response.setHeader(API_HEADERS.requestId, requestId);
      response.status(mapped.statusCode).json(mapped.body);
    }
  };
}

function createOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle("Merchant Operations Platform API")
    .setDescription("REST contract for merchant, customer, and platform surfaces.")
    .setVersion("1.0")
    .addCookieAuth(SESSION_COOKIE_NAME, undefined, SESSION_COOKIE_NAME)
    .addCookieAuth(PLATFORM_SESSION_COOKIE_NAME, undefined, PLATFORM_SESSION_COOKIE_NAME)
    .addApiKey({ in: "header", name: "Idempotency-Key", type: "apiKey" }, "idempotency-key")
    .build();
}

export function createOpenApiDocument(app: INestApplication) {
  const document = SwaggerModule.createDocument(app, createOpenApiConfig(), {
    operationIdFactory: (_controllerKey, methodKey) => methodKey,
  });

  document.components = {
    ...document.components,
    schemas: {
      ...document.components?.schemas,
      ...(commonOpenApiSchemas as OpenApiSchemas),
    },
  };

  return document;
}

export function configureOpenApi(
  app: INestApplication,
  environment: OpenApiEnvironment = process.env,
) {
  if (!isOpenApiEnabled(environment)) {
    return false;
  }

  if (isOpenApiPlatformAuthRequired(environment)) {
    const authorize = createOpenApiAuthorizationMiddleware(app.get(PlatformAuthService));
    app.use(OPENAPI_ROUTES.ui, authorize);
    app.use(OPENAPI_ROUTES.json, authorize);
    app.use(OPENAPI_ROUTES.yaml, authorize);
  }

  SwaggerModule.setup(OPENAPI_ROUTES.ui, app, () => createOpenApiDocument(app), {
    customSiteTitle: "Merchant Operations API",
    jsonDocumentUrl: OPENAPI_ROUTES.json,
    yamlDocumentUrl: OPENAPI_ROUTES.yaml,
  });

  return true;
}
