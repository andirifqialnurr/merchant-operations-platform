import type { PrismaClient } from "./generated/prisma/client.js";

export declare function createPrismaClient(): PrismaClient;
export declare function getPrismaClient(): PrismaClient;
export type DatabaseClient = PrismaClient;
