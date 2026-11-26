import express, { Router } from "express";
import { requireAuth, requireCsrf } from "../middlewares/auth.js";
import { noStore, rateLimit, requireJson } from "../middlewares/security.js";
import { OWNER_TRANSITIONS } from "../services/partnerPropertyService.js";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function propertyRouter(controller, config) {
  const r = Router({ mergeParams: true });
  r.get("/", controller.list);
  r.post("/", controller.create);
  r.get("/:id", controller.get);
  r.patch("/:id", controller.update);
  r.get("/:id/history", controller.history);
  for (const action of Object.keys(OWNER_TRANSITIONS)) {
    r.post(`/:id/${action}`, (req, res) => controller.transition(req, res, action));
  }
  r.post("/:id/photos",
    rateLimit({ windowMs: 60 * 60_000, max: 60, key: req => req.auth.user.id }),
    express.raw({ type: IMAGE_TYPES, limit: config.upload.maxBytes }),
    controller.uploadPhoto);
  r.patch("/:id/photos/:photoId", controller.updatePhoto);
  r.delete("/:id/photos/:photoId", controller.removePhoto);
  r.get("/:id/photos/:photoId/:variant", controller.photo);
  return r;
}

export function createPartnerRoutes({ controller, authController, authService, config }) {
  const router = Router();
  router.use("/me", noStore, requireAuth, requireCsrf(authService));
  router.get("/me", authController.me);
  // JSON exigido nas mutações, exceto no upload binário de fotos.
  router.use("/me", (req, res, next) => (req.path.endsWith("/photos") && req.method === "POST" ? next() : requireJson(req, res, next)));
  router.use("/me/properties", propertyRouter(controller, config));
  router.use("/me/agencies/:agencyId/properties", propertyRouter(controller, config));
  return router;
}
