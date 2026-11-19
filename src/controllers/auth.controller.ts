import type { Request, Response } from "express";
import { HttpError } from "../utils/http-error.js";

export function getCurrentUser(request: Request, response: Response): void {
  const user = request.authenticatedUser;
  if (user === undefined) {
    throw new HttpError(401, "Unauthorized", "Authentication is required.");
  }

  response.status(200).json({ user });
}
