import Stripe from "stripe";
import { config } from "./env.js";
import { HttpError } from "../utils/http-error.js";

let stripeClient: Stripe | null = null;

export interface StripeConfiguration {
  stripe: Stripe;
  webhookSecret: string;
  currency: string;
  clientUrl: URL;
}

export function getStripeConfiguration(): StripeConfiguration {
  const secretKey = config.stripeSecretKey?.trim();
  const webhookSecret = config.stripeWebhookSecret?.trim();
  const currency = config.stripeCurrency.trim().toLowerCase();

  if (!secretKey || !webhookSecret) {
    throw new HttpError(503, "Payment Service Unavailable", "Stripe payments are not configured.");
  }
  if (!/^sk_(test|live)_[A-Za-z0-9]+$/.test(secretKey) || !/^whsec_[A-Za-z0-9]+$/.test(webhookSecret)) {
    throw new HttpError(503, "Payment Service Unavailable", "Stripe payments are not configured.");
  }
  if (!/^[a-z]{3}$/.test(currency)) {
    throw new HttpError(503, "Payment Service Unavailable", "Stripe currency configuration is invalid.");
  }

  let clientUrl: URL;
  try {
    clientUrl = new URL(config.clientUrl);
  } catch {
    throw new HttpError(503, "Payment Service Unavailable", "Client URL configuration is invalid.");
  }
  const httpAllowedInEnvironment =
    config.nodeEnv !== "production" && clientUrl.protocol === "http:";
  if (
    (clientUrl.protocol !== "https:" && !httpAllowedInEnvironment) ||
    clientUrl.username !== "" ||
    clientUrl.password !== ""
  ) {
    throw new HttpError(503, "Payment Service Unavailable", "Client URL configuration is invalid.");
  }

  stripeClient ??= new Stripe(secretKey);
  return { stripe: stripeClient, webhookSecret, currency, clientUrl };
}
