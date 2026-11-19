import type { Collection } from "mongodb";
import { connectToDatabase } from "./database.js";
import { createDatabaseIndexes } from "./database-indexes.js";
import type {
  AppointmentDocument,
  ServiceDocument,
  TransactionDocument,
  UserDocument,
} from "../types/database.js";

export interface DatabaseCollections {
  users: Collection<UserDocument>;
  services: Collection<ServiceDocument>;
  appointments: Collection<AppointmentDocument>;
  transactions: Collection<TransactionDocument>;
}

let initializationPromise: Promise<DatabaseCollections> | null = null;

export function getDatabaseCollections(): Promise<DatabaseCollections> {
  if (initializationPromise !== null) {
    return initializationPromise;
  }

  const initialization = connectToDatabase().then(async (database) => {
    const collections: DatabaseCollections = {
      users: database.collection<UserDocument>("users"),
      services: database.collection<ServiceDocument>("services"),
      appointments: database.collection<AppointmentDocument>("appointments"),
      transactions: database.collection<TransactionDocument>("transactions"),
    };

    await createDatabaseIndexes(collections);
    return collections;
  });

  const sharedInitialization = initialization.catch((error: unknown) => {
    if (initializationPromise === sharedInitialization) {
      initializationPromise = null;
    }
    throw error;
  });

  initializationPromise = sharedInitialization;
  return sharedInitialization;
}
