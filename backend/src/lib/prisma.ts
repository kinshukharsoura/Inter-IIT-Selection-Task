import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** Transaction-scoped Prisma client type (as passed to `$transaction` callbacks). */
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type Db = typeof prisma | Tx;
