import type { RequestHandler } from "express";
import { getAuthenticatedUser } from "../services/auth.service.js";
import { HttpError } from "../utils/http-error.js";
import type { UserRole } from "../types/database.js";

export const requireAuth: RequestHandler = (request, _response, next) => {
  const authorization = request.get("authorization");
  const match = authorization === undefined ? null : /^Bearer\s+([^\s]+)$/i.exec(authorization);
  const token = match?.[1];

  if (token === undefined) {
    next(new HttpError(401, "Unauthorized", "A Bearer access token is required."));
    return;
  }

  void getAuthenticatedUser(token)
    .then((user) => {
      request.authenticatedUser = user;
      next();
    })
    .catch((error: unknown) => {
      next(error);
    });
};

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  if (allowedRoles.length === 0) {
    throw new Error("requireRole must be configured with at least one role.");
  }

  return (request, _response, next) => {
    const user = request.authenticatedUser;
    if (user === undefined) {
      next(new HttpError(401, "Unauthorized", "Authentication is required."));
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      next(new HttpError(403, "Forbidden", "You do not have permission to access this resource."));
      return;
    }

    next();
  };
}
