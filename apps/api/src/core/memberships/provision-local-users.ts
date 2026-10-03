/**
 * Creates outlet-scoped Manager and Cashier accounts on a development
 * database, so permissions and location scope can be tested with something
 * other than the Owner. Development only.
 *
 * Usage: pnpm --filter @merchant/api local:users:provision [tenant-slug]
 * Safe to run again: accounts that already exist are left alone. New
 * passwords are generated and written to the Git-ignored CREDENTIALS.local.md;
 * they are never printed.
 */
import "reflect-metadata";

import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../../app.module.js";
import { hashPassword } from "../auth/password.js";
import { AccessService } from "./access.service.js";

const CREDENTIALS_PATH = fileURLToPath(
  new URL("../../../../../CREDENTIALS.local.md", import.meta.url),
);
const LOGIN_URL = "http://localhost:4000/login";

const ACCOUNTS = [
  { displayName: "Local Manager", email: "pos.manager@local.test", roleCode: "MANAGER" },
  { displayName: "Local Cashier", email: "pos.cashier@local.test", roleCode: "CASHIER" },
] as const;

type CredentialRow = {
  displayName: string;
  email: string;
  password: string;
  roleCode: string;
  scope: string;
};

async function recordCredentials(rows: readonly CredentialRow[]) {
  const lines = (await readFile(CREDENTIALS_PATH, "utf8")).split("\n");
  const ownerRow = lines.findLastIndex((line) => line.includes("@local.test"));
  if (ownerRow < 0) throw new Error("CREDENTIALS.local.md has no account table to extend.");
  lines.splice(
    ownerRow + 1,
    0,
    ...rows.map(
      (row) =>
        `| ${row.displayName} | \`${LOGIN_URL}\` | \`${row.email}\` | \`${row.password}\` | \`${row.roleCode}\` | ${row.scope} | Active |`,
    ),
  );
  await writeFile(CREDENTIALS_PATH, lines.join("\n"));
}

async function provisionLocalUsers() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Local accounts are for development databases only.");
  }
  const prisma = createPrismaClient();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const slug = process.argv[2];
    const tenant = slug
      ? await prisma.tenant.findUnique({ where: { slug } })
      : await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
    if (!tenant) throw new Error(`Tenant ${slug ?? "(first)"} was not found.`);
    const outlet = await prisma.outlet.findFirst({
      orderBy: { createdAt: "asc" },
      where: { status: "ACTIVE", tenantId: tenant.id },
    });
    if (!outlet) throw new Error(`Tenant ${tenant.slug} has no active outlet.`);

    const created: CredentialRow[] = [];
    for (const account of ACCOUNTS) {
      if (await prisma.user.findUnique({ where: { email: account.email } })) {
        process.stdout.write(`${account.email} already exists; left unchanged.\n`);
        continue;
      }
      const role = await prisma.role.findUnique({
        where: { tenantId_code: { code: account.roleCode, tenantId: tenant.id } },
      });
      if (!role) throw new Error(`Role ${account.roleCode} is missing on tenant ${tenant.slug}.`);

      const password = randomBytes(12).toString("base64url");
      const user = await prisma.user.create({
        data: {
          displayName: account.displayName,
          email: account.email,
          passwordHash: await hashPassword(password),
        },
      });
      await app.get(AccessService).createMembership(tenant.id, {
        allOutlets: false,
        outletIds: [outlet.id],
        roleIds: [role.id],
        userId: user.id,
      });
      created.push({ ...account, password, scope: `${tenant.name}; ${outlet.name} saja` });
      process.stdout.write(`${account.email} created as ${account.roleCode} at ${outlet.name}.\n`);
    }

    if (created.length > 0) {
      await recordCredentials(created);
      process.stdout.write("Passwords were written to CREDENTIALS.local.md.\n");
    }
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

void provisionLocalUsers();
