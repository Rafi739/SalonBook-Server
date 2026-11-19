import type { DatabaseConnectionStatus } from "../config/database.js";

export interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
  uptimeSeconds: number;
  services: {
    api: "up";
    database: DatabaseConnectionStatus;
  };
}
