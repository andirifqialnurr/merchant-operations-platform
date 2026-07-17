import { commonOpenApiSchemas } from "@merchant/contracts";
import { type INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";

type OpenApiSchemas = NonNullable<OpenAPIObject["components"]>["schemas"];
type OpenApiEnvironment = {
  API_DOCS_ENABLED?: string;
  NODE_ENV?: string;
};

export function isOpenApiEnabled(environment: OpenApiEnvironment = process.env) {
  if (environment.NODE_ENV === "production") {
    return false;
  }

  return environment.API_DOCS_ENABLED !== "false";
}

function createOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle("Merchant Operations Platform API")
    .setDescription("REST contract for merchant, customer, and platform surfaces.")
    .setVersion("1.0")
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

export function configureOpenApi(app: INestApplication) {
  if (!isOpenApiEnabled()) {
    return false;
  }

  SwaggerModule.setup("api/docs", app, () => createOpenApiDocument(app), {
    customSiteTitle: "Merchant Operations API",
    jsonDocumentUrl: "api/openapi.json",
    yamlDocumentUrl: "api/openapi.yaml",
  });

  return true;
}
