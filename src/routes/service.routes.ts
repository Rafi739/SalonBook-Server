
import { Router } from "express";
import {
  createServiceController,
  deleteServiceController,
  getPublicServiceController,
  listAdminServicesController,
  listPublicServicesController,
  updateServiceController,
  updateServiceStatusController,
} from "../controllers/service.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const serviceRouter = Router();

// Public service routes
serviceRouter.get("/", listPublicServicesController);
serviceRouter.get("/:id", getPublicServiceController);

// Admin service routes
serviceRouter.get(
  "/admin",
  requireAuth,
  requireRole("admin"),
  listAdminServicesController,
);

serviceRouter.post("/", requireAuth, requireRole("admin"), createServiceController);
serviceRouter.patch("/:id/status", requireAuth, requireRole("admin"), updateServiceStatusController);
serviceRouter.patch("/:id", requireAuth, requireRole("admin"), updateServiceController);
serviceRouter.delete("/:id", requireAuth, requireRole("admin"), deleteServiceController);

export { serviceRouter };
