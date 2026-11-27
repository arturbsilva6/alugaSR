import { errors } from "../lib/errors.js";
import { hasAnyRole } from "../services/authorization.js";

export function sessionCookieName(config) {
  // Prefixo __Host- exige Secure, Path=/ e ausência de Domain (proteção contra subdomínios).
  return config.cookieSecure ? "__Host-alugasr_sid" : "alugasr_sid";
}

export function parseCookies(header) {
  const out = {};
  if (typeof header !== "string" || header.length > 8192) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    if (!Object.hasOwn(out, name)) out[name] = part.slice(i + 1).trim();
  }
  return out;
}

export function setSessionCookie(res, config, token, expiresAt) {
  res.cookie(sessionCookieName(config), token, {
    httpOnly: true, secure: config.cookieSecure, sameSite: "strict", path: "/", expires: expiresAt
  });
}

export function clearSessionCookie(res, config) {
  res.clearCookie(sessionCookieName(config), { httpOnly: true, secure: config.cookieSecure, sameSite: "strict", path: "/" });
}

// Carrega a sessão (se houver) sem exigir autenticação.
export function loadSession(authService, config) {
  const name = sessionCookieName(config);
  return async (req, _res, next) => {
    try {
      const token = parseCookies(req.headers.cookie)[name];
      req.auth = token ? await authService.resolveSession(token) : null;
      next();
    } catch (error) { next(error); }
  };
}

export function requireAuth(req, _res, next) {
  if (!req.auth) return next(errors.unauthenticated());
  next();
}

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
// CSRF por token sincronizado derivado da sessão (HMAC) no cabeçalho X-CSRF-Token.
export function requireCsrf(authService) {
  return (req, _res, next) => {
    if (SAFE.has(req.method)) return next();
    if (!req.auth || !authService.verifyCsrf(req.auth.tokenHash, req.get("x-csrf-token"))) return next(errors.csrf());
    next();
  };
}

export function requireRoles(roles) {
  return (req, _res, next) => {
    if (!hasAnyRole(req.auth?.user, roles)) return next(errors.forbidden());
    next();
  };
}
