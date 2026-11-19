import type { TransactionStatus } from "../types/database.js";
import { HttpError } from "../utils/http-error.js";
import { parseMongoObjectId } from "../utils/mongo-id.js";
import { isRecord, parsePositiveInteger } from "./common.validators.js";

export interface CreateCheckoutInput {
  appointmentId: ReturnType<typeof parseMongoObjectId>;
}

export interface TransactionListQuery {
  page: number;
  limit: number;
  status?: TransactionStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

const transactionStatuses = new Set<TransactionStatus>(["pending", "completed", "failed", "refunded"]);
const checkoutFields = new Set(["appointmentId"]);
const listFields = new Set(["page", "limit", "status", "dateFrom", "dateTo"]);
const maximumPageSize = 100;
const maximumOffset = 1_000_000;

function rejectUnknownFields(value: Record<string, unknown>, allowedFields: Set<string>): void {
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      throw new HttpError(400, "Bad Request", `Field "${field}" is not allowed.`);
    }
  }
}

function readQueryString(query: Record<string, unknown>, key: string): string | undefined {
  const value = query[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, "Bad Request", `Query parameter "${key}" must be a single string.`);
  }
  return value;
}

function parseDate(value: string | undefined, field: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, "Bad Request", `${field} must use YYYY-MM-DD format.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, "Bad Request", `${field} must be a valid calendar date.`);
  }
  return date;
}

function parseTransactionListQuery(value: unknown): TransactionListQuery {
  if (!isRecord(value)) {
    throw new HttpError(400, "Bad Request", "Invalid transaction list query.");
  }
  rejectUnknownFields(value, listFields);

  const page = parsePositiveInteger(readQueryString(value, "page"), "page", 1);
  const limit = parsePositiveInteger(readQueryString(value, "limit"), "limit", 20);
  if (limit > maximumPageSize) {
    throw new HttpError(400, "Bad Request", `Query parameter "limit" cannot exceed ${maximumPageSize}.`);
  }
  if ((page - 1) * limit > maximumOffset) {
    throw new HttpError(400, "Bad Request", "The requested page is too large.");
  }

  const statusValue = readQueryString(value, "status");
  if (statusValue !== undefined && !transactionStatuses.has(statusValue as TransactionStatus)) {
    throw new HttpError(400, "Bad Request", "Invalid transaction status filter.");
  }
  const dateFrom = parseDate(readQueryString(value, "dateFrom"), "dateFrom");
  const dateTo = parseDate(readQueryString(value, "dateTo"), "dateTo");
  if (dateFrom !== undefined && dateTo !== undefined && dateFrom > dateTo) {
    throw new HttpError(400, "Bad Request", "dateFrom cannot be after dateTo.");
  }

  const query: TransactionListQuery = { page, limit };
  if (statusValue !== undefined) {
    query.status = statusValue as TransactionStatus;
  }
  if (dateFrom !== undefined) {
    query.dateFrom = dateFrom;
  }
  if (dateTo !== undefined) {
    query.dateTo = dateTo;
  }
  return query;
}

export function validateCreateCheckout(value: unknown): CreateCheckoutInput {
  if (!isRecord(value)) {
    throw new HttpError(400, "Bad Request", "The request body must be a JSON object.");
  }
  rejectUnknownFields(value, checkoutFields);
  if (typeof value.appointmentId !== "string") {
    throw new HttpError(400, "Bad Request", "A valid appointmentId is required.");
  }
  return { appointmentId: parseMongoObjectId(value.appointmentId, "appointment") };
}

export function parseCustomerTransactionQuery(value: unknown): Pick<TransactionListQuery, "page" | "limit"> {
  const query = parseTransactionListQuery(value);
  if (query.status !== undefined || query.dateFrom !== undefined || query.dateTo !== undefined) {
    throw new HttpError(400, "Bad Request", "Customer transaction history supports only page and limit.");
  }
  return { page: query.page, limit: query.limit };
}

export function parseAdminTransactionQuery(value: unknown): TransactionListQuery {
  return parseTransactionListQuery(value);
}
