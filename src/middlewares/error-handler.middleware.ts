import type { ErrorRequestHandler } from "express";
import { HttpError } from "../utils/http-error.js";

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  console.error("Unhandled request error:", error);

  response.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred.",
  });
};
