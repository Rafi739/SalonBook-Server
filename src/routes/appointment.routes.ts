import { Router } from "express";
import {
  cancelAppointmentController,
  createAppointmentController,
  getAppointmentController,
  listAppointmentsController,
  listMyAppointmentsController,
  updateAppointmentStatusController,
} from "../controllers/appointment.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const appointmentRouter = Router();

appointmentRouter.post("/", requireAuth, requireRole("customer"), createAppointmentController);
appointmentRouter.get("/me", requireAuth, listMyAppointmentsController);
appointmentRouter.get("/", requireAuth, requireRole("admin"), listAppointmentsController);
appointmentRouter.get("/:id", requireAuth, getAppointmentController);
appointmentRouter.patch("/:id/cancel", requireAuth, cancelAppointmentController);
appointmentRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("admin"),
  updateAppointmentStatusController,
);

export { appointmentRouter };
