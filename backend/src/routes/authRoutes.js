import { Router } from "express";
import { requireAuth, requireCsrf } from "../middlewares/auth.js";
import { noStore, rateLimit, requireJson } from "../middlewares/security.js";
import { errors } from "../lib/errors.js";

export function createAuthRoutes({ controller, authService, config }) {
  const router = Router();
  router.use("/auth", noStore, requireJson);
  router.post("/auth/login", rateLimit({ windowMs: 60_000, max: config.rateLimits.loginPerIpPerMinute }), controller.login);
  // Cadastro público DESLIGADO (Gate C1): contas apenas sintéticas via seed/CLI controlado.
  router.post("/auth/register", (_req, _res, next) => next(config.features.publicRegistration
    ? errors.unavailable() : errors.featureDisabled()));
  router.get("/auth/session", requireAuth, controller.session);
  const csrf = requireCsrf(authService);
  // Logout sem sessão é idempotente (204); com sessão, exige token CSRF.
  router.post("/auth/logout", (req, res, next) => (req.auth ? csrf(req, res, next) : next()), controller.logout);
  router.post("/auth/logout-all", requireAuth, requireCsrf(authService), controller.logoutAll);
  router.post("/auth/password/change", requireAuth, requireCsrf(authService), rateLimit({ windowMs: 15 * 60_000, max: 10 }), controller.changePassword);
  return router;
}
