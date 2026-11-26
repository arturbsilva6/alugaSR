import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma Client 7 com driver adapter pg. Consultas são sempre parametrizadas;
// SQL bruto só via tagged template ($queryRaw``), nunca $queryRawUnsafe.
export function createPrisma(connectionString, { max = 10 } = {}) {
  if (!connectionString) return null;
  const adapter = new PrismaPg({ connectionString, max, connectionTimeoutMillis: 2500, idleTimeoutMillis: 10000 });
  return new PrismaClient({ adapter, log: [] });
}
