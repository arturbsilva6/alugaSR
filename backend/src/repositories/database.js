import { createPrisma } from "../db/prisma.js";

// Conexão única via Prisma (driver adapter pg). `ping` atende /api/v1/ready.
export function createDatabase(connectionString) {
  const prisma = createPrisma(connectionString);
  if (!prisma) return null;
  return {
    prisma,
    async ping() {
      const rows = await prisma.$queryRaw`SELECT 1::int AS status`;
      return rows[0]?.status === 1;
    },
    async close() {
      await prisma.$disconnect();
    }
  };
}
