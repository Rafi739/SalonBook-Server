import { HttpError } from "./http-error.js";

const zeroDecimalCurrencies = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf",
  "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);
const threeDecimalCurrencies = new Set(["bhd", "jod", "kwd", "omr", "tnd"]);

export function getCurrencyExponent(currency: string): number {
  if (!/^[a-z]{3}$/.test(currency)) {
    throw new HttpError(503, "Payment Service Unavailable", "Stripe currency configuration is invalid.");
  }
  if (zeroDecimalCurrencies.has(currency)) {
    return 0;
  }
  if (threeDecimalCurrencies.has(currency)) {
    return 3;
  }
  return 2;
}

export function toMinorCurrencyUnit(amount: number, currency: string): number {
  const exponent = getCurrencyExponent(currency);
  const multiplier = 10 ** exponent;
  const minorAmount = Math.round(amount * multiplier);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isSafeInteger(minorAmount) ||
    Math.abs(amount * multiplier - minorAmount) > 1e-7
  ) {
    throw new HttpError(400, "Bad Request", "Appointment price cannot be represented in the configured currency.");
  }
  return minorAmount;
}
