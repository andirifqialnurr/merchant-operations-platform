import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(configDirectory, "../../.env") });

export default defineConfig({
  migrations: {
    path: "prisma/migrations",
  },
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
