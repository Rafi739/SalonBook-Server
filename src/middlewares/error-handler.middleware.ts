import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  console.error("Unhandled request error:", error);

  response.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred.",
  });
};
