import {
  createCheckoutSession,
  listAdminTransactions,
  listCustomerTransactions,
  processStripeWebhook,
} from "../services/payment.service.js";
import { getRequestUser } from "../utils/request-auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import {
  parseAdminTransactionQuery,
  parseCustomerTransactionQuery,
  validateCreateCheckout,
} from "../validators/payment.validators.js";
import { HttpError } from "../utils/http-error.js";

export const createCheckoutSessionController = asyncHandler(async (request, response) => {
  const customer = getRequestUser(request);
  const input = validateCreateCheckout(request.body);
  const checkout = await createCheckoutSession(input.appointmentId, customer);
  response.status(200).json({ sessionId: checkout.id, url: checkout.url });
});

export const customerTransactionsController = asyncHandler(async (request, response) => {
  const customer = getRequestUser(request);
  const query = parseCustomerTransactionQuery(request.query);
  const result = await listCustomerTransactions(customer.id, query);
  response.status(200).json(result);
});

export const adminTransactionsController = asyncHandler(async (request, response) => {
  const query = parseAdminTransactionQuery(request.query);
  const result = await listAdminTransactions(query);
  response.status(200).json(result);
});

export const stripeWebhookController = asyncHandler(async (request, response) => {
  if (!Buffer.isBuffer(request.body)) {
    throw new HttpError(400, "Invalid Webhook", "A raw Stripe webhook payload is required.");
  }
  await processStripeWebhook(request.body, request.get("stripe-signature"));
  response.status(200).json({ received: true });
});
