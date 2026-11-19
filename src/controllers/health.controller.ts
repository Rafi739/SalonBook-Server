import type { Request, Response } from "express";
import { getHealthStatus } from "../services/health.service.js";

export function getHealth(_request: Request, response: Response): void {
  const health = getHealthStatus();
  response.status(health.status === "ok" ? 200 : 503).json(health);
}
