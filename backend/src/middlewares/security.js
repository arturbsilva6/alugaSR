import { errors } from "../lib/errors.js";
import { createRateLimiter } from "../lib/rateLimit.js";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

// Defesa adicional contra CSRF: requisições com Origin/Referer de terceiros são recusadas.
export function enforceSameOrigin(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, _res, next) => {
    if (SAFE.has(req.method)) return next();
    const origin = req.get("origin");
    if (origin !== undefined) return allowed.has(origin) ? next() : next(errors.forbidden("Origem não permitida"));
    const referer = req.get("referer");
    if (referer) {
      try { if (!allowed.has(new URL(referer).origin)) return next(errors.forbidden("Origem não permitida")); }
      catch { return next(errors.forbidden("Origem não permitida")); }
    }
    next();
  };
}

export function noStore(_req, res, next) {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  next();
}

export function rateLimit({ windowMs, max, key = req => req.ip }) {
  const limiter = createRateLimiter({ windowMs, max });
  return (req, _res, next) => (limiter.consume(key(req)) ? next() : next(errors.rateLimited()));
}

// Exige corpo JSON nas mutações (impede envio cross-site de formulários simples).
export function requireJson(req, _res, next) {
  if (SAFE.has(req.method) || req.method === "DELETE") return next();
  const length = Number(req.get("content-length") ?? 0);
  if (length === 0 && !req.get("transfer-encoding")) { req.body = {}; return next(); }
  if (!req.is("application/json")) return next(errors.unsupportedMedia("Use Content-Type: application/json"));
  next();
}
