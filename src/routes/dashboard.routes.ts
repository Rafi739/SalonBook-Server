
import { Router } from "express";
import { adminDashboardOverviewController } from "../controllers/dashboard.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const dashboardRouter = Router();

dashboardRouter.get(
  "/overview",
  requireAuth,
  requireRole("admin"),
  adminDashboardOverviewController,
);

export { dashboardRouter };
