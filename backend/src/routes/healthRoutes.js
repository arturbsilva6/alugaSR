import { Router } from "express";
import { createHealthController } from "../controllers/healthController.js";

export function createHealthRoutes(service) {
  const router = Router();
  const controller = createHealthController(service);
  router.get("/health", controller.liveness);
  router.get("/ready", controller.readiness);
  return router;
}
