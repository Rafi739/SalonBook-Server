import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config/env.js";
import { errorHandler } from "./middlewares/error-handler.middleware.js";
import { notFoundHandler } from "./middlewares/not-found.middleware.js";
import { paymentWebhookRouter } from "./routes/payment-webhook.routes.js";
import { apiRouter } from "./routes/index.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientUrl }));
app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  paymentWebhookRouter,
);
app.use(express.json());
app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
