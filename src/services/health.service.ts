import { pingDatabaseConnection } from "../config/database.js";
import type { HealthResponse } from "../types/health.js";

export async function getHealthStatus(): Promise<HealthResponse> {
  const database = await pingDatabaseConnection();

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
