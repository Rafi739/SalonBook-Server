import type { Request, Response } from "express";

export function notFoundHandler(request: Request, response: Response): void {
  response.status(404).json({
    error: "Not Found",
    message: `No route found for ${request.method} ${request.originalUrl}.`,
  });
}
