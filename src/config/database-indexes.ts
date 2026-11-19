import type { DatabaseCollections } from "./collections.js";

export async function createDatabaseIndexes(collections: DatabaseCollections): Promise<void> {
  await Promise.all([
    collections.users.createIndex(
      { email: 1 },
      { unique: true, name: "users_email_unique" },
    ),
    collections.services.createIndex(
      { category: 1, status: 1 },
      { name: "services_category_status" },
    ),
    collections.services.createIndex(
      { price: 1 },
      { name: "services_price" },
    ),
    collections.appointments.createIndex(
      { customerId: 1 },
      { name: "appointments_customer" },
    ),
    collections.appointments.createIndex(
      { appointmentDate: 1, status: 1 },
      { name: "appointments_date_status" },
    ),
    collections.transactions.createIndex(
      { appointmentId: 1 },
      { name: "transactions_appointment" },
    ),
    collections.transactions.createIndex(
      { stripeSessionId: 1 },
      {
        unique: true,
        partialFilterExpression: { stripeSessionId: { $type: "string" } },
        name: "transactions_stripe_session_unique",
      },
    ),
  ]);
}
