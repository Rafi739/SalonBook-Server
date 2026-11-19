import type { ObjectId } from "mongodb";
import type { UserRole } from "../types/database.js";
import { HttpError } from "../utils/http-error.js";
import { parseMongoObjectId } from "../utils/mongo-id.js";
import { isRecord, parsePositiveInteger } from "./common.validators.js";

export interface ProfileUpdate {
  name?: string;
  image?: string;
}

export type UserSortField = "name" | "email" | "createdAt";
export type UserSortOrder = "asc" | "desc";

export interface UserListQuery {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  blocked?: boolean;
  sortBy: UserSortField;
  sortOrder: UserSortOrder;
}

const allowedProfileFields = new Set(["name", "image"]);
const allowedListQueryFields = new Set([
  "page",
  "limit",
  "search",
  "role",
  "blocked",
  "sortBy",
  "sortOrder",
]);
const maximumPageSize = 100;
const maximumOffset = 1_000_000;

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

export function validateProfileUpdate(value: unknown): ProfileUpdate {
  if (!isRecord(value)) {
    throw new HttpError(400, "Bad Request", "The request body must be a JSON object.");
  }

  for (const field of Object.keys(value)) {
    if (!allowedProfileFields.has(field)) {
      throw new HttpError(400, "Bad Request", `Field "${field}" cannot be updated.`);
    }
  }

  const update: ProfileUpdate = {};
  if (Object.hasOwn(value, "name")) {
    const name = value.name;
    if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 100) {
      throw new HttpError(400, "Bad Request", "Name must contain between 1 and 100 characters.");
    }
    update.name = name.trim();
  }

  if (Object.hasOwn(value, "image")) {
    const image = value.image;
    if (typeof image !== "string" || image.trim().length === 0 || image.trim().length > 2048) {
      throw new HttpError(400, "Bad Request", "Image must be a valid HTTP or HTTPS URL.");
    }

    let imageUrl: URL;
    try {
      imageUrl = new URL(image.trim());
    } catch {
      throw new HttpError(400, "Bad Request", "Image must be a valid HTTP or HTTPS URL.");
    }
    if (
      (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") ||
      imageUrl.hostname === "" ||
      imageUrl.username !== "" ||
      imageUrl.password !== ""
    ) {
      throw new HttpError(400, "Bad Request", "Image must be a valid HTTP or HTTPS URL.");
    }

    update.image = imageUrl.toString();
  }

  if (Object.keys(update).length === 0) {
    throw new HttpError(400, "Bad Request", "Provide a name or image to update.");
  }
  return update;
}

export function parseUserListQuery(value: unknown): UserListQuery {
  if (!isRecord(value)) {
    throw new HttpError(400, "Bad Request", "Invalid user list query.");
  }

  for (const field of Object.keys(value)) {
    if (!allowedListQueryFields.has(field)) {
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

  const roleValue = readQueryString(value, "role");
  if (roleValue !== undefined && roleValue !== "customer" && roleValue !== "admin") {
    throw new HttpError(400, "Bad Request", "Role must be customer or admin.");
  }

  const blockedValue = readQueryString(value, "blocked");
  if (blockedValue !== undefined && blockedValue !== "true" && blockedValue !== "false") {
    throw new HttpError(400, "Bad Request", "Blocked must be true or false.");
  }

  const sortByValue = readQueryString(value, "sortBy");
  const sortBy = sortByValue ?? "createdAt";
  if (sortBy !== "name" && sortBy !== "email" && sortBy !== "createdAt") {
    throw new HttpError(400, "Bad Request", "Sort field must be name, email, or createdAt.");
  }

  const sortOrderValue = readQueryString(value, "sortOrder");
  const sortOrder = sortOrderValue ?? "desc";
  if (sortOrder !== "asc" && sortOrder !== "desc") {
    throw new HttpError(400, "Bad Request", "Sort order must be asc or desc.");
  }

  const query: UserListQuery = { page, limit, sortBy, sortOrder };
  if (search !== undefined && search.length > 0) {
    query.search = search;
  }
  if (roleValue !== undefined) {
    query.role = roleValue;
  }
  if (blockedValue !== undefined) {
    query.blocked = blockedValue === "true";
  }
  return query;
}

export function parseUserObjectId(value: string | undefined): ObjectId {
  return parseMongoObjectId(value, "user");
}
