import type { Request } from "express";
import type { AuthenticatedUser } from "../types/auth.js";
import { HttpError } from "./http-error.js";

export function getRequestUser(request: Request): AuthenticatedUser {
  const user = request.authenticatedUser;
  if (user === undefined) {
    throw new HttpError(401, "Unauthorized", "Authentication is required.");
  }
  return user;
}
