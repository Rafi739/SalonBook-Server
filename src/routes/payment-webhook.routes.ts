import { Router } from "express";
import { stripeWebhookController } from "../controllers/payment.controller.js";

const paymentWebhookRouter = Router();

paymentWebhookRouter.post("/", stripeWebhookController);

export { paymentWebhookRouter };
