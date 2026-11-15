import express from "express";
import helmet from "helmet";
import { requestId } from "./middlewares/requestId.js";
import { notFound, safeError } from "./middlewares/errors.js";
import { createHealthService } from "./services/healthService.js";
import { createHealthRoutes } from "./routes/healthRoutes.js";

export function createApp({ database = null } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(requestId);
  app.use(express.json({ limit: "32kb" }));
  app.use("/api/v1", createHealthRoutes(createHealthService(database)));
  app.use(notFound);
  app.use(safeError);
  return app;
}
