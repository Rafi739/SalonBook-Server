import type { ServiceCategory, ServiceDocument, ServiceStatus } from "../types/database.js";
import { HttpError } from "../utils/http-error.js";
import { isRecord, parsePositiveInteger } from "./common.validators.js";

type ServiceInputFields = Pick<
  ServiceDocument,
  "serviceName" | "category" | "description" | "price" | "duration" | "image"
>;

export interface CreateServiceInput extends ServiceInputFields {
  status?: ServiceStatus;
}

export type UpdateServiceInput = Partial<ServiceInputFields & Pick<ServiceDocument, "status">>;

export type ServicePriceSort = "price_asc" | "price_desc";

export interface PublicServiceListQuery {
  page: number;
  limit: number;
  search?: string;
  category?: ServiceCategory;
  sort: ServicePriceSort;
}

const serviceFields = new Set([
  "serviceName",
  "category",
  "description",
  "price",
  "duration",
  "image",
  "status",
]);
const listQueryFields = new Set(["page", "limit", "search", "category", "sort"]);
const maximumPageSize = 100;
const maximumOffset = 1_000_000;

function rejectUnknownFields(value: Record<string, unknown>, allowedFields: Set<string>): void {
  for (const field of Object.keys(value)) {
    if (!allowedFields.has(field)) {
      throw new HttpError(400, "Bad Request", `Field "${field}" is not allowed.`);
    }
  }
}

function readServiceName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > 120) {
    throw new HttpError(400, "Bad Request", "Service name must contain between 1 and 120 characters.");
  }
  return value.trim();
}

function readCategory(value: unknown): ServiceCategory {
  if (value !== "Men's" && value !== "Women's" && value !== "Unisex") {
    throw new HttpError(400, "Bad Request", "Category must be Men's, Women's, or Unisex.");
  }
  return value;
}

function readDescription(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > 2000) {
    throw new HttpError(400, "Bad Request", "Description must contain between 1 and 2000 characters.");
  }
  return value.trim();
}

function readPrice(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new HttpError(400, "Bad Request", "Price must be a positive finite number.");
  }
  return value;
}

function readDuration(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new HttpError(400, "Bad Request", "Duration must be a positive integer number of minutes.");
  }
  return value;
}

function readImageUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > 2048) {
    throw new HttpError(400, "Bad Request", "Image must be a valid HTTPS URL.");
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(value.trim());
  } catch {
    throw new HttpError(400, "Bad Request", "Image must be a valid HTTPS URL.");
  }
  if (
    imageUrl.protocol !== "https:" ||
    imageUrl.hostname === "" ||
    imageUrl.username !== "" ||
    imageUrl.password !== ""
  ) {
    throw new HttpError(400, "Bad Request", "Image must be a valid HTTPS URL.");
  }
  return imageUrl.toString();
}

function readStatus(value: unknown): ServiceStatus {
  if (value !== "active" && value !== "inactive") {
    throw new HttpError(400, "Bad Request", "Status must be active or inactive.");
  }
  return value;
}

export function validateCreateService(value: unknown): CreateServiceInput {
  if (!isRecord(value)) {
    throw new HttpError(400, "Bad Request", "The request body must be a JSON object.");
  }
  rejectUnknownFields(value, serviceFields);

  const service: CreateServiceInput = {
    serviceName: readServiceName(value.serviceName),
    category: readCategory(value.category),
    description: readDescription(value.description),
    price: readPrice(value.price),
    duration: readDuration(value.duration),
    image: readImageUrl(value.image),
  };
  if (Object.hasOwn(value, "status")) {
    service.status = readStatus(value.status);
  }
  return service;
}

export function validateServiceUpdate(value: unknown): UpdateServiceInput {
  if (!isRecord(value)) {
    throw new HttpError(400, "Bad Request", "The request body must be a JSON object.");
  }
  rejectUnknownFields(value, serviceFields);

  const update: UpdateServiceInput = {};
  if (Object.hasOwn(value, "serviceName")) {
    update.serviceName = readServiceName(value.serviceName);
  }
  if (Object.hasOwn(value, "category")) {
    update.category = readCategory(value.category);
  }
  if (Object.hasOwn(value, "description")) {
    update.description = readDescription(value.description);
  }
  if (Object.hasOwn(value, "price")) {
    update.price = readPrice(value.price);
  }
  if (Object.hasOwn(value, "duration")) {
    update.duration = readDuration(value.duration);
  }
  if (Object.hasOwn(value, "image")) {
    update.image = readImageUrl(value.image);
  }
  if (Object.hasOwn(value, "status")) {
    update.status = readStatus(value.status);
  }
  if (Object.keys(update).length === 0) {
    throw new HttpError(400, "Bad Request", "Provide at least one valid service field to update.");
  }
  return update;
}

export function validateServiceStatus(value: unknown): Pick<ServiceDocument, "status"> {
  if (!isRecord(value)) {
    throw new HttpError(400, "Bad Request", "The request body must be a JSON object.");
  }
  rejectUnknownFields(value, new Set(["status"]));
  if (!Object.hasOwn(value, "status")) {
    throw new HttpError(400, "Bad Request", "Status is required.");
  }
  return { status: readStatus(value.status) };
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

export function parsePublicServiceListQuery(value: unknown): PublicServiceListQuery {
  if (!isRecord(value)) {
    throw new HttpError(400, "Bad Request", "Invalid service list query.");
  }
  for (const field of Object.keys(value)) {
    if (!listQueryFields.has(field)) {
      throw new HttpError(400, "Bad Request", `Query parameter "${field}" is not supported.`);
    }
  }

  const page = parsePositiveInteger(readQueryString(value, "page"), "page", 1);
  const limit = parsePositiveInteger(readQueryString(value, "limit"), "limit", 20);
  if (limit > maximumPageSize) {
    throw new HttpError(400, "Bad Request", `Query parameter "limit" cannot exceed ${maximumPageSize}.`);
  }
  if ((page - 1) * limit > maximumOffset) {
    throw new HttpError(400, "Bad Request", "The requested page is too large.");
  }

  const searchValue = readQueryString(value, "search");
  const search = searchValue?.trim();
  if (search !== undefined && search.length > 100) {
    throw new HttpError(400, "Bad Request", "Search must not exceed 100 characters.");
  }

  const categoryValue = readQueryString(value, "category");
  const category = categoryValue === undefined ? undefined : readCategory(categoryValue);
  const sortValue = readQueryString(value, "sort");
  const sort = sortValue ?? "price_asc";
  if (sort !== "price_asc" && sort !== "price_desc") {
    throw new HttpError(400, "Bad Request", "Sort must be price_asc or price_desc.");
  }

  const query: PublicServiceListQuery = { page, limit, sort };
  if (search !== undefined && search.length > 0) {
    query.search = search;
  }
  if (category !== undefined) {
    query.category = category;
  }
  return query;
}
