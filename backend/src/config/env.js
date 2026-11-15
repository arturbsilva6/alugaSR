export function readRuntimeConfig(env = process.env) {
  const rawPort = env.PORT ?? "3000";
  if (!/^\d+$/.test(String(rawPort))) throw new Error("PORT inválida: use inteiro entre 1 e 65535");
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT inválida: use inteiro entre 1 e 65535");
  }
  const isProduction = env.NODE_ENV === "production";
  if (isProduction && !env.DATABASE_URL) throw new Error("DATABASE_URL obrigatória em produção");
  return {
    port,
    host: env.HOST || (isProduction ? "0.0.0.0" : "127.0.0.1"),
    databaseUrl: env.DATABASE_URL || null,
    isProduction
  };
}
