import { Router } from "express";
import { rateLimit } from "../middlewares/security.js";

export function createPublicRoutes(controller, config) {
  const router = Router();
  // RN-T07: limite contra raspagem/abuso; não bloqueia navegação normal.
  router.use(rateLimit({ windowMs: 60_000, max: config.rateLimits.publicPerIpPerMinute }));
  router.get("/meta", controller.meta);
  router.get("/catalog/neighborhoods", controller.neighborhoods);
  router.get("/catalog/property-types", controller.propertyTypes);
  router.get("/catalog/features", controller.features);
  router.get("/properties", controller.search);
  router.get("/properties/:id", controller.detail);
  router.get("/properties/:id/photos/:photoId/:variant", controller.photo);
  return router;
}
