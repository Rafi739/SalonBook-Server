
import { ObjectId } from "mongodb";
import type { AppointmentStatus, PaymentStatus } from "../types/database.js";
import { HttpError } from "../utils/http-error.js";
import { parseMongoObjectId } from "../utils/mongo-id.js";
import { isRecord, parsePositiveInteger } from "./common.validators.js";

export interface CreateAppointmentInput {
  serviceId: ObjectId;
  appointmentDate: Date;
  timeSlot: string;
  message?: string;
}

export interface AppointmentHistoryQuery {
  page: number;
  limit: number;
  status?: AppointmentStatus;
}

export type AppointmentSortField = "appointmentDate" | "createdAt";
export type AppointmentSortOrder = "asc" | "desc";

export interface AdminAppointmentQuery extends AppointmentHistoryQuery {
  paymentStatus?: PaymentStatus;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy: AppointmentSortField;
  sortOrder: AppointmentSortOrder;
}

const allowedCreateFields = new Set([
  "serviceId",
  "appointmentDate",
  "timeSlot",
  "message",
]);

const historyQueryFields = new Set(["page", "limit", "status"]);

const adminQueryFields = new Set([
  ...historyQueryFields,
  "paymentStatus",
  "dateFrom",
  "dateTo",
  "sortBy",
  "sortOrder",
]);

const maximumPageSize = 100;
const maximumOffset = 1_000_000;

function rejectUnknownFields(
  value: Record<string, unknown>,
  allowedFields: Set<string>,
): void {
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      throw new HttpError(
        400,
        "Bad Request",
        `Field "${field}" is not allowed.`,
      );
    }
  }
}

function readDateOnly(value: unknown, field: string): Date {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new HttpError(
      400,
      "Bad Request",
      `${field} must use YYYY-MM-DD format.`,
    );
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new HttpError(
      400,
      "Bad Request",
      `${field} must be a valid calendar date.`,
    );
  }

  return date;
}

function readOptionalQueryString(
  query: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = query[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "Bad Request",
      `Query parameter "${key}" must be a single string.`,
    );
  }

  return value;
}

function readStatus(
  value: string | undefined,
): AppointmentStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value !== "pending" &&
    value !== "confirmed" &&
    value !== "cancelled" &&
    value !== "rejected" &&
    value !== "completed"
  ) {
    throw new HttpError(
      400,
      "Bad Request",
      "Invalid appointment status.",
    );
  }

  return value;
}

function readPagination(
  query: Record<string, unknown>,
): { page: number; limit: number } {
  const page = parsePositiveInteger(
    readOptionalQueryString(query, "page"),
    "page",
    1,
  );

  const limit = parsePositiveInteger(
    readOptionalQueryString(query, "limit"),
    "limit",
    20,
  );

  if (limit > maximumPageSize) {
    throw new HttpError(
      400,
      "Bad Request",
      `Query parameter "limit" cannot exceed ${maximumPageSize}.`,
    );
  }

  if ((page - 1) * limit > maximumOffset) {
    throw new HttpError(
      400,
      "Bad Request",
      "The requested page is too large.",
    );
  }

  return { page, limit };
}

export function validateCreateAppointment(
  value: unknown,
): CreateAppointmentInput {
  if (!isRecord(value)) {
    throw new HttpError(
      400,
      "Bad Request",
      "The request body must be a JSON object.",
    );
  }

  rejectUnknownFields(value, allowedCreateFields);

  const serviceIdValue = value.serviceId;

  if (typeof serviceIdValue !== "string") {
    throw new HttpError(
      400,
      "Bad Request",
      "A valid serviceId is required.",
    );
  }

  const serviceId = parseMongoObjectId(serviceIdValue, "service");

  const appointmentDate = readDateOnly(
    value.appointmentDate,
    "appointmentDate",
  );

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (appointmentDate < today) {
    throw new HttpError(
      400,
      "Bad Request",
      "Appointment date cannot be in the past.",
    );
  }

  if (
    typeof value.timeSlot !== "string" ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.timeSlot)
  ) {
    throw new HttpError(
      400,
      "Bad Request",
      "timeSlot must use 24-hour HH:mm format.",
    );
  }

  const appointment: CreateAppointmentInput = {
    serviceId,
    appointmentDate,
    timeSlot: value.timeSlot,
  };

  if (Object.hasOwn(value, "message")) {
    if (
      typeof value.message !== "string" ||
      value.message.trim().length > 1000
    ) {
      throw new HttpError(
        400,
        "Bad Request",
        "message must be a string of at most 1000 characters.",
      );
    }

    appointment.message = value.message.trim();
  }

  return appointment;
}

export function parseAppointmentHistoryQuery(
  value: unknown,
): AppointmentHistoryQuery {
  if (!isRecord(value)) {
    throw new HttpError(
      400,
      "Bad Request",
      "Invalid appointment history query.",
    );
  }

  rejectUnknownFields(value, historyQueryFields);

  const query: AppointmentHistoryQuery = readPagination(value);

  const status = readStatus(
    readOptionalQueryString(value, "status"),
  );

  if (status !== undefined) {
    query.status = status;
  }

  return query;
}

export function parseAdminAppointmentQuery(
  value: unknown,
): AdminAppointmentQuery {
  if (!isRecord(value)) {
    throw new HttpError(
      400,
      "Bad Request",
      "Invalid appointment list query.",
    );
  }

  rejectUnknownFields(value, adminQueryFields);

  const paymentStatusValue = readOptionalQueryString(
    value,
    "paymentStatus",
  );

  if (
    paymentStatusValue !== undefined &&
    paymentStatusValue !== "paid" &&
    paymentStatusValue !== "unpaid"
  ) {
    throw new HttpError(
      400,
      "Bad Request",
      "paymentStatus must be paid or unpaid.",
    );
  }

  const dateFromValue = readOptionalQueryString(value, "dateFrom");
  const dateToValue = readOptionalQueryString(value, "dateTo");

  const dateFrom =
    dateFromValue === undefined
      ? undefined
      : readDateOnly(dateFromValue, "dateFrom");

  const dateTo =
    dateToValue === undefined
      ? undefined
      : readDateOnly(dateToValue, "dateTo");

  if (
    dateFrom !== undefined &&
    dateTo !== undefined &&
    dateFrom > dateTo
  ) {
    throw new HttpError(
      400,
      "Bad Request",
      "dateFrom cannot be after dateTo.",
    );
  }

  const sortByValue = readOptionalQueryString(value, "sortBy");
  const sortBy = sortByValue ?? "appointmentDate";

  if (
    sortBy !== "appointmentDate" &&
    sortBy !== "createdAt"
  ) {
    throw new HttpError(
      400,
      "Bad Request",
      "sortBy must be appointmentDate or createdAt.",
    );
  }

  const sortOrderValue = readOptionalQueryString(value, "sortOrder");
  const sortOrder = sortOrderValue ?? "desc";

  if (sortOrder !== "asc" && sortOrder !== "desc") {
    throw new HttpError(
      400,
      "Bad Request",
      "sortOrder must be asc or desc.",
    );
  }

  const query: AdminAppointmentQuery = {
    ...readPagination(value),
    sortBy,
    sortOrder,
  };

  const status = readStatus(
    readOptionalQueryString(value, "status"),
  );

  if (status !== undefined) {
    query.status = status;
  }

  if (paymentStatusValue !== undefined) {
    query.paymentStatus = paymentStatusValue;
  }

  if (dateFrom !== undefined) {
    query.dateFrom = dateFrom;
  }

  if (dateTo !== undefined) {
    query.dateTo = dateTo;
  }

  return query;
}

export function validateAppointmentStatus(
  value: unknown,
): AppointmentStatus {
  if (!isRecord(value)) {
    throw new HttpError(
      400,
      "Bad Request",
      "The request body must be a JSON object.",
    );
  }

  rejectUnknownFields(value, new Set(["status"]));

  if (!Object.hasOwn(value, "status")) {
    throw new HttpError(
      400,
      "Bad Request",
      "A valid appointment status is required.",
    );
  }

  const status = readStatus(
    typeof value.status === "string"
      ? value.status
      : undefined,
  );

  if (status === undefined) {
    throw new HttpError(
      400,
      "Bad Request",
      "A valid appointment status is required.",
    );
  }

  return status;
}
