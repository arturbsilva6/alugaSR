import { randomBytes } from "node:crypto";
import { readFeatureFlags } from "./features.js";

function positiveInt(env, name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(String(raw))) throw new Error(`${name} inválida: use inteiro entre ${min} e ${max}`);
  const n = Number(raw);
  if (n < min || n > max) throw new Error(`${name} inválida: use inteiro entre ${min} e ${max}`);
  return n;
}

export function readRuntimeConfig(env = process.env) {
  const rawPort = env.PORT ?? "3000";
  if (!/^\d+$/.test(String(rawPort))) throw new Error("PORT inválida: use inteiro entre 1 e 65535");
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT inválida: use inteiro entre 1 e 65535");
  }
  const isProduction = env.NODE_ENV === "production";
  const isTest = env.NODE_ENV === "test";
  if (isProduction && !env.DATABASE_URL) throw new Error("DATABASE_URL obrigatória em produção");

  // Segredo de sessão/CSRF/cursor. Em produção é obrigatório e forte; fora dela,
  // na ausência, gera um valor efêmero (sessões não sobrevivem a reinício).
  const sessionSecret = env.SESSION_SECRET || null;
  if (isProduction && (!sessionSecret || sessionSecret.length < 32)) {
    throw new Error("SESSION_SECRET obrigatória em produção (mínimo 32 caracteres)");
  }

  const cookieSecure = env.COOKIE_SECURE ? env.COOKIE_SECURE === "true" : isProduction;
  if (isProduction && !cookieSecure) throw new Error("COOKIE_SECURE=false não é permitido em produção");

  const host = env.HOST || (isProduction ? "0.0.0.0" : "127.0.0.1");
  const appOrigins = (env.APP_ORIGINS || (isProduction ? "" : `http://127.0.0.1:${port},http://localhost:${port}`))
    .split(",").map(s => s.trim()).filter(Boolean);
  if (isProduction && appOrigins.length === 0) throw new Error("APP_ORIGINS obrigatória em produção");
  for (const origin of appOrigins) {
    if (!/^https?:\/\/[^/\s]+$/.test(origin)) throw new Error("APP_ORIGINS contém origem inválida");
  }

  // DEC-011: o adaptador local é apenas para desenvolvimento/teste. O storage de
  // produção (Object Storage privado) está PENDENTE de decisão de fornecedor (EXT-05).
  const storageDriver = env.STORAGE_DRIVER || "local";
  if (storageDriver !== "local") throw new Error(`STORAGE_DRIVER '${storageDriver}' não implementado`);
  if (isProduction) throw new Error("Storage de produção pendente (DEC-011/EXT-05): adaptador local não pode ser usado em produção");

  return {
    port,
    host,
    databaseUrl: env.DATABASE_URL || null,
    isProduction,
    isTest,
    sessionSecret: sessionSecret || randomBytes(32).toString("base64url"),
    sessionSecretEphemeral: !sessionSecret,
    cookieSecure,
    appOrigins,
    // Valores iniciais de sessão (RN-A05: parâmetros finais pendentes, EXT-08).
    sessionAbsoluteMinutes: positiveInt(env, "SESSION_ABSOLUTE_MINUTES", 480, { max: 7 * 24 * 60 }),
    sessionIdleMinutes: positiveInt(env, "SESSION_IDLE_MINUTES", 30, { max: 24 * 60 }),
    storage: { driver: storageDriver, localDir: env.STORAGE_LOCAL_DIR || ".storage" },
    // Limites conservadores e configuráveis (seção 19.4 PENDENTE de valores finais).
    upload: {
      maxBytes: positiveInt(env, "UPLOAD_MAX_BYTES", 5 * 1024 * 1024, { max: 20 * 1024 * 1024 }),
      maxPhotosPerProperty: positiveInt(env, "UPLOAD_MAX_PHOTOS", 10, { max: 30 }),
      maxInputPixels: positiveInt(env, "UPLOAD_MAX_PIXELS", 40_000_000, { max: 100_000_000 })
    },
    // RN-T07: limites iniciais (valores finais PENDENTES, EXT-08).
    rateLimits: {
      loginPerIpPer15Min: positiveInt(env, "RATE_LIMIT_LOGIN_IP_15MIN", 30, { max: 100_000 }),
      loginFailuresPerAccount: positiveInt(env, "RATE_LIMIT_LOGIN_ACCOUNT_FAILURES", 5, { max: 1000 }),
      loginPerIpPerMinute: positiveInt(env, "RATE_LIMIT_LOGIN_IP_MINUTE", 20, { max: 100_000 }),
      publicPerIpPerMinute: positiveInt(env, "RATE_LIMIT_PUBLIC_IP_MINUTE", 300, { max: 1_000_000 })
    },
    // MFA para moderação/administração é obrigatório em produção (RN-A04) e ainda
    // não foi implementado: em produção as rotas de moderação ficam bloqueadas.
    requireMfaForModeration: isProduction,
    demoMode: env.DEMO_MODE ? env.DEMO_MODE === "true" : !isProduction,
    serveFrontend: env.SERVE_FRONTEND ? env.SERVE_FRONTEND === "true" : !isProduction,
    trustProxy: env.TRUST_PROXY === "true",
    features: readFeatureFlags(env)
  };
}
