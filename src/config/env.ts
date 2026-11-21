
import "dotenv/config";

function readPort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return 4000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function readNodeEnv(
  value: string | undefined,
): "development" | "production" | "test" {
  if (value === undefined || value === "") {
    return "development";
  }

  if (
    value === "development" ||
    value === "production" ||
    value === "test"
  ) {
    return value;
  }

  throw new Error("NODE_ENV must be development, production, or test.");
}

export const config = {
  port: readPort(process.env.PORT),
  nodeEnv: readNodeEnv(process.env.NODE_ENV),

  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",

  mongodbUri: process.env.MONGODB_URI,
  mongodbDatabase: process.env.MONGODB_DATABASE,

  betterAuthJwksUrl: process.env.BETTER_AUTH_JWKS_URL,
  betterAuthIssuer: process.env.BETTER_AUTH_ISSUER,
  betterAuthAudience: process.env.BETTER_AUTH_AUDIENCE,

  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  stripeCurrency: process.env.STRIPE_CURRENCY ?? "usd",
};
