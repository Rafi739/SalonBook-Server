import { Router } from "express";
import {
  adminTransactionsController,
  createCheckoutSessionController,
  customerTransactionsController,
} from "../controllers/payment.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const paymentRouter = Router();

paymentRouter.post(
  "/create-checkout-session",
  requireAuth,
  requireRole("customer"),
  createCheckoutSessionController,
);
paymentRouter.get("/me", requireAuth, requireRole("customer"), customerTransactionsController);
paymentRouter.get("/", requireAuth, requireRole("admin"), adminTransactionsController);

export { paymentRouter };
