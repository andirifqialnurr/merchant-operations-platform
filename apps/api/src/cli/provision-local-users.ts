/**
 * Creates outlet-scoped Manager, Cashier, and Kitchen accounts on a
 * development database, so permissions and location scope can be tested with
 * something other than the Owner. It also installs the modules the workspace
 * is entitled to and registers one kitchen screen. Development only.
 *
 * Usage: pnpm --filter @merchant/api local:users:provision [tenant-slug]
 * Safe to run again: accounts that already exist are left alone. New
 * passwords and the kitchen screen's activation code are written to the
 * Git-ignored CREDENTIALS.local.md; they are never printed. The activation
 * code is short-lived: once it has expired, issue a new one in Settings >
 * Devices.
 */
import "reflect-metadata";

import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { createPrismaClient } from "@merchant/database";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module.js";
import { hashPassword } from "../core/auth/public.js";
import { DeviceService } from "../core/devices/public.js";
import { InstallationService } from "../core/installations/public.js";
import { AccessService } from "../core/memberships/public.js";

const CREDENTIALS_PATH = fileURLToPath(
  new URL("../../../../CREDENTIALS.local.md", import.meta.url),
);
const LOGIN_URL = "http://localhost:4000/login";

const ACCOUNTS = [
  { displayName: "Local Manager", email: "pos.manager@local.test", roleCode: "MANAGER" },
  { displayName: "Local Cashier", email: "pos.cashier@local.test", roleCode: "CASHIER" },
  { displayName: "Local Kitchen", email: "kds.kitchen@local.test", roleCode: "KITCHEN" },
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

const KITCHEN_DEVICE_LABEL = "Dapur Lokal";

/** Appends the kitchen screen's one-time code under its own heading. */
async function recordDeviceCode(label: string, outletName: string, code: string) {
  const current = await readFile(CREDENTIALS_PATH, "utf8");
  await writeFile(
    CREDENTIALS_PATH,
    `${current.trimEnd()}\n\n## Perangkat\n\n| Perangkat | Outlet | Kode aktivasi | Catatan |\n| --- | --- | --- | --- |\n| ${label} | ${outletName} | \`${code}\` | Sekali pakai dan cepat kedaluwarsa; buat kode baru di Pengaturan > Perangkat |\n`,
  );
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

    // Every module the package includes, the kitchen among them. Installing
    // again changes nothing.
    const installed = await app.get(InstallationService).provisionEntitled(tenant.id);
    process.stdout.write(
      `Installed modules: ${installed.map((item) => item.moduleKey).join(", ") || "none"}.\n`,
    );

    const kitchenScreen = await prisma.coreDevice.findFirst({
      where: { mode: "KDS", outletId: outlet.id, status: { not: "REVOKED" }, tenantId: tenant.id },
    });
    if (kitchenScreen) {
      process.stdout.write(
        `Kitchen screen "${kitchenScreen.label}" already exists; left unchanged.\n`,
      );
    } else {
      // A device is registered by a person; the workspace's owner stands in.
      const owner = await prisma.userRole.findFirst({
        select: { membership: { select: { userId: true } } },
        where: { role: { code: "OWNER" }, tenantId: tenant.id },
      });
      if (!owner) throw new Error(`Tenant ${tenant.slug} has no owner to register a device.`);
      const ticket = await app
        .get(DeviceService)
        .register(
          tenant.id,
          { label: KITCHEN_DEVICE_LABEL, mode: "KDS", outletId: outlet.id },
          { actorId: owner.membership.userId },
        );
      await recordDeviceCode(KITCHEN_DEVICE_LABEL, outlet.name, ticket.activationCode);
      process.stdout.write(
        `Kitchen screen "${KITCHEN_DEVICE_LABEL}" registered at ${outlet.name}; its activation code was written to CREDENTIALS.local.md.\n`,
      );
    }
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

void provisionLocalUsers();
