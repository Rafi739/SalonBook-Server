import { getDatabaseConnectionStatus } from "../config/database.js";
import type { HealthResponse } from "../types/health.js";

export function getHealthStatus(): HealthResponse {
  const database = getDatabaseConnectionStatus();

  return {
    status: database === "connected" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    services: {
      api: "up",
      database,
    },
  };
}
