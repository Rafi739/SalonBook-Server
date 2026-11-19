import { HttpError } from "../utils/http-error.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePositiveInteger(value: string | undefined, field: string, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (!/^[0-9]+$/.test(value)) {
    throw new HttpError(400, "Bad Request", `Query parameter "${field}" must be a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new HttpError(400, "Bad Request", `Query parameter "${field}" must be a positive integer.`);
  }
  return parsed;
}
