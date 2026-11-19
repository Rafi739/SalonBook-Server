import { Db, MongoClient } from "mongodb";
import { config } from "./env.js";

export type DatabaseConnectionStatus = "disconnected" | "connecting" | "connected";

let client: MongoClient | null = null;
let connectionPromise: Promise<Db> | null = null;
let connectionStatus: DatabaseConnectionStatus = "disconnected";

export function getDatabaseConnectionStatus(): DatabaseConnectionStatus {
  return connectionStatus;
}

export function connectToDatabase(): Promise<Db> {
  if (connectionPromise !== null) {
    return connectionPromise;
  }

  if (config.mongodbUri === undefined || config.mongodbUri.trim() === "") {
    return Promise.reject(new Error("MONGODB_URI is not configured."));
  }
  if (config.mongodbDatabase === undefined || config.mongodbDatabase.trim() === "") {
    return Promise.reject(new Error("MONGODB_DATABASE is not configured."));
  }

  const mongoClient = new MongoClient(config.mongodbUri);
  client = mongoClient;
  connectionStatus = "connecting";

  connectionPromise = (async () => {
    try {
      await mongoClient.connect();
      const database = mongoClient.db(config.mongodbDatabase);
      await database.command({ ping: 1 });
      connectionStatus = "connected";
      return database;
    } catch (error: unknown) {
      connectionStatus = "disconnected";
      client = null;
      connectionPromise = null;
      try {
        await mongoClient.close();
      } catch (closeError: unknown) {
        console.error("Failed to close MongoDB client after a connection error:", closeError);
      }
      throw error;
    }
  })();

  return connectionPromise;
}

export async function closeDatabaseConnection(): Promise<void> {
  const pendingConnection = connectionPromise;
  if (pendingConnection !== null) {
    await pendingConnection.catch(() => undefined);
  }

  const currentClient = client;
  client = null;
  connectionPromise = null;
  connectionStatus = "disconnected";
  if (currentClient !== null) {
    await currentClient.close();
  }
}
