import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { ApiExceptionFilter } from "./api-exception.filter.js";
import { AppModule } from "./app.module.js";
import { configureOpenApi } from "./openapi.js";
import {
  createCsrfProtectionMiddleware,
  createSecurityHeadersMiddleware,
} from "./security/http-security.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.API_PORT ?? 3001);

  app.use(createSecurityHeadersMiddleware());
  app.use(createCsrfProtectionMiddleware());
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new ApiExceptionFilter());
  configureOpenApi(app);

  await app.listen(port);
}

void bootstrap();
