import { Db, MongoClient, type ClientSession } from "mongodb";
import { config } from "./env.js";

export type DatabaseConnectionStatus = "disconnected" | "connecting" | "connected";

let client: MongoClient | null = null;
let connectionPromise: Promise<Db> | null = null;
let connectionStatus: DatabaseConnectionStatus = "disconnected";
let healthCheckPromise: Promise<DatabaseConnectionStatus> | null = null;

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

  const mongoClient = new MongoClient(config.mongodbUri, {
    serverSelectionTimeoutMS: 5000,
  });
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

export async function withDatabaseTransaction(
  operation: (session: ClientSession) => Promise<void>,
): Promise<void> {
  await connectToDatabase();
  const activeClient = client;
  if (activeClient === null) {
    throw new Error("MongoDB client is not available.");
  }

  const session = activeClient.startSession();
  try {
    const transactionCompleted = await session.withTransaction(async () => {
      await operation(session);
      return true;
    });
    if (transactionCompleted !== true) {
      throw new Error("MongoDB transaction did not return a result.");
    }
  } finally {
    await session.endSession();
  }
}

export function pingDatabaseConnection(): Promise<DatabaseConnectionStatus> {
  if (connectionStatus === "connecting" || connectionPromise === null) {
    return Promise.resolve(connectionStatus);
  }
  if (healthCheckPromise !== null) {
    return healthCheckPromise;
  }

  const currentConnection = connectionPromise;
  healthCheckPromise = currentConnection
    .then(async (database) => {
      await database.command({ ping: 1 });
      connectionStatus = "connected";
      return connectionStatus;
    })
    .catch(() => {
      connectionStatus = "disconnected";
      return connectionStatus;
    })
    .finally(() => {
      healthCheckPromise = null;
    });

  return healthCheckPromise;
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
