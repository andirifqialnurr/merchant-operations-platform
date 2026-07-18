import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL wajib tersedia sebelum Prisma Client dibuat.");
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

export type DatabaseClient = PrismaClient;
