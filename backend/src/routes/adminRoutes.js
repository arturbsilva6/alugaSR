import { Router } from "express";
import { requireAuth, requireCsrf, requireRoles } from "../middlewares/auth.js";
import { noStore, requireJson } from "../middlewares/security.js";
import { MODERATION_ROLES } from "../services/authorization.js";
import { errors } from "../lib/errors.js";

export function createAdminRoutes({ controller, authService, config }) {
  const router = Router();
  router.use("/admin", noStore, requireAuth, requireCsrf(authService), requireRoles(MODERATION_ROLES), requireJson);
  // RN-A04: MFA obrigatório para moderação em produção — ainda não implementado (EXT-08).
  router.use("/admin", (_req, _res, next) => next(config.requireMfaForModeration ? errors.forbidden("MFA obrigatório para moderação não implementado") : undefined));
  router.get("/admin/property-submissions", controller.queue);
  router.get("/admin/property-submissions/:id", controller.submission);
  router.get("/admin/property-submissions/:id/photos/:photoId/:variant", controller.photo);
  for (const decision of ["approve", "reject", "suspend"]) {
    router.post(`/admin/properties/:id/${decision}`, (req, res) => controller.decide(req, res, decision));
  }
  return router;
}
