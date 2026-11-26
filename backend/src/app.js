import express from "express";
import helmet from "helmet";
import { fileURLToPath } from "node:url";
import { requestId } from "./middlewares/requestId.js";
import { notFound, safeError } from "./middlewares/errors.js";
import { loadSession } from "./middlewares/auth.js";
import { enforceSameOrigin } from "./middlewares/security.js";
import { errors } from "./lib/errors.js";
import { createCursorCodec } from "./lib/cursor.js";
import { readRuntimeConfig } from "./config/env.js";
import { createHealthService } from "./services/healthService.js";
import { createHealthRoutes } from "./routes/healthRoutes.js";
import { createCatalogRepository } from "./repositories/catalogRepository.js";
import { createPublicPropertyRepository } from "./repositories/publicPropertyRepository.js";
import { createAuthRepository } from "./repositories/authRepository.js";
import { createAuditRepository } from "./repositories/auditRepository.js";
import { createPartnerRepository } from "./repositories/partnerRepository.js";
import { createModerationRepository } from "./repositories/moderationRepository.js";
import { createCatalogService } from "./services/catalogService.js";
import { createPublicPropertyService } from "./services/publicPropertyService.js";
import { createAuthService } from "./services/authService.js";
import { createOwnerScopeResolver } from "./services/authorization.js";
import { createPartnerPropertyService } from "./services/partnerPropertyService.js";
import { createModerationService } from "./services/moderationService.js";
import { createPublicController } from "./controllers/publicController.js";
import { createAuthController } from "./controllers/authController.js";
import { createPartnerController } from "./controllers/partnerController.js";
import { createModerationController } from "./controllers/moderationController.js";
import { createPublicRoutes } from "./routes/publicRoutes.js";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { createPartnerRoutes } from "./routes/partnerRoutes.js";
import { createAdminRoutes } from "./routes/adminRoutes.js";
import { createLocalStorage } from "./storage/localStorage.js";

const FRONTEND_DIR = fileURLToPath(new URL("../../frontend/", import.meta.url));

function createDomainRouter({ prisma, config, storage }) {
  const audit = createAuditRepository(prisma);
  const catalogRepository = createCatalogRepository(prisma);
  const partnerRepository = createPartnerRepository(prisma);
  const authService = createAuthService({ repository: createAuthRepository(prisma), audit, config });
  const publicPropertyService = createPublicPropertyService({
    repository: createPublicPropertyRepository(prisma), storage, cursorCodec: createCursorCodec(config.sessionSecret)
  });
  const partnerPropertyService = createPartnerPropertyService({ repository: partnerRepository, catalogRepository, audit, storage, config });
  const moderationService = createModerationService({ repository: createModerationRepository(prisma), partnerRepository, audit, storage });

  const authController = createAuthController({ authService, config });
  const router = express.Router();
  router.use(loadSession(authService, config));
  router.use(createPublicRoutes(createPublicController({ catalogService: createCatalogService(catalogRepository), publicPropertyService, config }), config));
  router.use(createAuthRoutes({ controller: authController, authService, config }));
  router.use(createPartnerRoutes({
    controller: createPartnerController({ partnerPropertyService, scopes: createOwnerScopeResolver(partnerRepository) }),
    authController, authService, config
  }));
  router.use(createAdminRoutes({ controller: createModerationController({ moderationService }), authService, config }));
  return router;
}

export function createApp({ database = null, config: overrides = {}, storage } = {}) {
  const config = { ...readRuntimeConfig(), ...overrides };
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], baseUri: ["'none'"], formAction: ["'self'"], objectSrc: ["'none'"], frameAncestors: ["'none'"],
        scriptSrc: ["'self'"], styleSrc: ["'self'"], imgSrc: ["'self'", "data:", "blob:"], fontSrc: ["'self'"], connectSrc: ["'self'"]
      }
    },
    strictTransportSecurity: config.cookieSecure ? { maxAge: 15552000, includeSubDomains: false } : false,
    referrerPolicy: { policy: "same-origin" }
  }));
  app.use(requestId);
  app.use(express.json({ limit: "32kb" }));
  app.use("/api/v1", createHealthRoutes(createHealthService(database)));

  const prisma = database?.prisma ?? null;
  if (prisma) {
    app.use("/api/v1", enforceSameOrigin(config.appOrigins));
    app.use("/api/v1", createDomainRouter({ prisma, config, storage: storage ?? createLocalStorage(config.storage.localDir) }));
  } else {
    // Sem banco configurado, as rotas de domínio respondem 503 genérico.
    const domain = /^\/(meta|catalog|properties|auth|me|admin)(\/|$)/;
    app.use("/api/v1", (req, _res, next) => next(domain.test(req.path) ? errors.unavailable() : undefined));
  }
  app.use("/api", notFound);

  if (config.serveFrontend) {
    app.use(express.static(FRONTEND_DIR, { index: "index.html", dotfiles: "deny", redirect: false, setHeaders(res) { res.set("Cache-Control", "no-cache"); } }));
  }
  app.use(notFound);
  app.use(safeError);
  return app;
}
