import { app } from "./app.js";
import { closeDatabaseConnection, connectToDatabase } from "./config/database.js";
import { config } from "./config/env.js";

const server = app.listen(config.port, () => {
  console.log(`SalonBook API listening on port ${config.port} (${config.nodeEnv}).`);
  void connectToDatabase().catch((error: unknown) => {
    console.error("MongoDB connection failed:", error);
  });
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`${signal} received; shutting down.`);
  server.close(() => {
    void closeDatabaseConnection()
      .then(() => {
        console.log("Server shut down successfully.");
      })
      .catch((error: unknown) => {
        console.error("Failed to close MongoDB connection:", error);
        process.exitCode = 1;
      });
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
