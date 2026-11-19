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
      { customerId: 1, appointmentDate: -1, createdAt: -1 },
      { name: "appointments_customer_history" },
    ),
    collections.appointments.createIndex(
      { appointmentDate: 1, status: 1 },
      { name: "appointments_date_status" },
    ),
    collections.appointments.createIndex(
      { paymentStatus: 1, appointmentDate: -1 },
      { name: "appointments_payment_date" },
    ),
    collections.appointments.createIndex(
      { customerId: 1, appointmentDate: 1, timeSlot: 1 },
      {
        unique: true,
        partialFilterExpression: { status: { $in: ["pending", "confirmed"] } },
        name: "appointments_active_customer_slot_unique",
      },
    ),
    collections.transactions.createIndex(
      { appointmentId: 1 },
      { name: "transactions_appointment" },
    ),
    collections.transactions.createIndex(
      { appointmentId: 1 },
      {
        unique: true,
        partialFilterExpression: { status: "pending" },
        name: "transactions_pending_appointment_unique",
      },
    ),
    collections.transactions.createIndex(
      { createdAt: -1 },
      { name: "transactions_created_at" },
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
