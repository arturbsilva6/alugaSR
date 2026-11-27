import "dotenv/config";
import { defineConfig } from "prisma/config";

// DATABASE_URL só é exigida por comandos que acessam o banco (migrate, seed);
// validate/generate/format funcionam sem credenciais.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.mjs"
  },
  datasource: { url: process.env.DATABASE_URL ?? "" }
});
