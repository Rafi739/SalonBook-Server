
import Stripe from "stripe";
import {
  MongoServerError,
  ObjectId,
  type Filter,
  type WithId,
} from "mongodb";

import { getDatabaseCollections } from "../config/collections.js";
import { withDatabaseTransaction } from "../config/database.js";
import { getStripeConfiguration } from "../config/stripe.js";

import type {
  AppointmentDocument,
  TransactionDocument,
  UserDocument,
} from "../types/database.js";

import type { AuthenticatedUser } from "../types/auth.js";
import type {
  TransactionListResult,
  TransactionView,
} from "../types/payments.js";

import type { TransactionListQuery } from "../validators/payment.validators.js";

import { HttpError } from "../utils/http-error.js";
import { toMinorCurrencyUnit } from "../utils/currency.js";

type TransactionWithId = WithId<TransactionDocument>;

const transactionSafeProjection = {
  _id: 1,
  appointmentId: 1,
  customerId: 1,
  amount: 1,
  currency: 1,
  status: 1,
  createdAt: 1,
} as const;

const appointmentProjection = {
  _id: 1,
  customerId: 1,
  serviceId: 1,
  servicePrice: 1,
  paymentStatus: 1,
  status: 1,
  appointmentDate: 1,
  timeSlot: 1,
} as const;

function toTransactionView(
  transaction: TransactionWithId,
): TransactionView {
  return {
    id: transaction._id.toHexString(),
    appointmentId: transaction.appointmentId.toHexString(),
    amount: transaction.amount,
    currency: transaction.currency,
    status: transaction.status,
    createdAt: transaction.createdAt,
  };
}

function getPagination(
  page: number,
  limit: number,
  total: number,
): TransactionListResult["pagination"] {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
}

function stripeFailure(): HttpError {
  return new HttpError(
    502,
    "Payment Provider Error",
    "Stripe could not process the payment request.",
  );
}

async function findOwnedAppointment(
  appointmentId: ObjectId,
  customerId: ObjectId,
): Promise<WithId<AppointmentDocument>> {
  const { appointments } = await getDatabaseCollections();

  const appointment = await appointments.findOne(
    {
      _id: appointmentId,
      customerId,
    },
    {
      projection: appointmentProjection,
    },
  );

  if (appointment === null) {
    throw new HttpError(
      404,
      "Not Found",
      "Appointment not found.",
    );
  }

  if (appointment.status !== "confirmed") {
    throw new HttpError(
      409,
      "Conflict",
      "Only confirmed appointments can be paid.",
    );
  }

  if (appointment.paymentStatus !== "unpaid") {
    throw new HttpError(
      409,
      "Conflict",
      "This appointment is not eligible for payment.",
    );
  }

  return appointment;
}

async function findOrReserveTransaction(
  appointment: WithId<AppointmentDocument>,
  customerId: ObjectId,
  currency: string,
): Promise<TransactionWithId> {
  const { transactions } = await getDatabaseCollections();

  const existing = await transactions.findOne({
    appointmentId: appointment._id,
    status: "pending",
  });

  if (existing !== null) {
    if (
      !existing.customerId.equals(customerId) ||
      existing.amount !== appointment.servicePrice ||
      existing.currency !== currency
    ) {
      throw new HttpError(
        409,
        "Conflict",
        "An existing payment attempt does not match this appointment.",
      );
    }

    return existing;
  }

  const document: TransactionDocument = {
    appointmentId: appointment._id,
    customerId,
    amount: appointment.servicePrice,
    currency,
    stripeSessionId: null,
    status: "pending",
    createdAt: new Date(),
  };

  try {
    const result = await transactions.insertOne(document);

    return {
      _id: result.insertedId,
      ...document,
    };
  } catch (error: unknown) {
    if (
      !(error instanceof MongoServerError) ||
      error.code !== 11000
    ) {
      throw error;
    }

    const concurrentTransaction = await transactions.findOne({
      appointmentId: appointment._id,
      status: "pending",
    });

    if (concurrentTransaction === null) {
      throw error;
    }

    if (
      !concurrentTransaction.customerId.equals(customerId) ||
      concurrentTransaction.amount !== appointment.servicePrice ||
      concurrentTransaction.currency !== currency
    ) {
      throw new HttpError(
        409,
        "Conflict",
        "An existing payment attempt does not match this appointment.",
      );
    }

    return concurrentTransaction;
  }
}

async function createOrReuseCheckoutSession(
  appointment: WithId<AppointmentDocument>,
  customer: AuthenticatedUser,
): Promise<{ id: string; url: string }> {
  if (customer.role !== "customer") {
    throw new HttpError(
      403,
      "Forbidden",
      "Only customers can initiate payments.",
    );
  }

  const { stripe, currency, clientUrl } =
    getStripeConfiguration();

  const customerId = new ObjectId(customer.id);

  const ownedAppointment = await findOwnedAppointment(
    appointment._id,
    customerId,
  );

  const amount = toMinorCurrencyUnit(
    ownedAppointment.servicePrice,
    currency,
  );

  const { services, transactions } =
    await getDatabaseCollections();

  const service = await services.findOne(
    {
      _id: ownedAppointment.serviceId,
    },
    {
      projection: {
        serviceName: 1,
      },
    },
  );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const transaction = await findOrReserveTransaction(
      ownedAppointment,
      customerId,
      currency,
    );

    if (transaction.stripeSessionId !== null) {
      let existingSession: Stripe.Checkout.Session;

      try {
        existingSession =
          await stripe.checkout.sessions.retrieve(
            transaction.stripeSessionId,
          );
      } catch {
        throw stripeFailure();
      }

      if (
        existingSession.status === "open" &&
        existingSession.url !== null
      ) {
        return {
          id: existingSession.id,
          url: existingSession.url,
        };
      }

      if (existingSession.status === "expired") {
        await transactions.updateOne(
          {
            _id: transaction._id,
            status: "pending",
          },
          {
            $set: {
              status: "failed",
            },
          },
        );

        continue;
      }

      throw new HttpError(
        409,
        "Conflict",
        "This appointment already has a checkout session in progress.",
      );
    }

    let session: Stripe.Checkout.Session;

    try {
      session = await stripe.checkout.sessions.create(
        {
          mode: "payment",

          line_items: [
            {
              quantity: 1,
              price_data: {
                currency,
                unit_amount: amount,
                product_data: {
                  name:
                    service?.serviceName ??
                    "SalonBook appointment",
                },
              },
            },
          ],

          client_reference_id:
            ownedAppointment._id.toHexString(),

          metadata: {
            appointmentId:
              ownedAppointment._id.toHexString(),
            customerId: customerId.toHexString(),
            transactionId:
              transaction._id.toHexString(),
          },

          payment_intent_data: {
            metadata: {
              appointmentId:
                ownedAppointment._id.toHexString(),
              customerId: customerId.toHexString(),
              transactionId:
                transaction._id.toHexString(),
            },
          },

          success_url: new URL(
            "/booking/payment/success?session_id={CHECKOUT_SESSION_ID}",
            clientUrl,
          ).toString(),

          cancel_url: new URL(
            `/booking/payment/cancel?appointmentId=${ownedAppointment._id.toHexString()}`,
            clientUrl,
          ).toString(),
        },
        {
          idempotencyKey:
            `salonbook-checkout-${transaction._id.toHexString()}`,
        },
      );
    } catch {
      throw stripeFailure();
    }

    if (session.url === null) {
      throw stripeFailure();
    }

    await transactions.updateOne(
      {
        _id: transaction._id,
        status: "pending",
        stripeSessionId: null,
      },
      {
        $set: {
          stripeSessionId: session.id,
        },
      },
    );

    return {
      id: session.id,
      url: session.url,
    };
  }

  throw new HttpError(
    409,
    "Conflict",
    "A new checkout session could not be reserved.",
  );
}

export async function createCheckoutSession(
  appointmentId: ObjectId,
  customer: AuthenticatedUser,
): Promise<{ id: string; url: string }> {
  const { appointments } = await getDatabaseCollections();

  const appointment = await appointments.findOne(
    {
      _id: appointmentId,
    },
    {
      projection: appointmentProjection,
    },
  );

  if (appointment === null) {
    throw new HttpError(
      404,
      "Not Found",
      "Appointment not found.",
    );
  }

  if (
    customer.role !== "customer" ||
    !appointment.customerId.equals(new ObjectId(customer.id))
  ) {
    throw new HttpError(
      404,
      "Not Found",
      "Appointment not found.",
    );
  }

  return createOrReuseCheckoutSession(
    appointment,
    customer,
  );
}

function readSessionMetadata(
  session: Stripe.Checkout.Session,
): {
  appointmentId: ObjectId;
  customerId: ObjectId;
  transactionId: ObjectId;
} | null {
  const appointmentId = session.metadata?.appointmentId;
  const customerId = session.metadata?.customerId;
  const transactionId = session.metadata?.transactionId;

  if (
    appointmentId === undefined ||
    customerId === undefined ||
    transactionId === undefined ||
    !ObjectId.isValid(appointmentId) ||
    !ObjectId.isValid(customerId) ||
    !ObjectId.isValid(transactionId)
  ) {
    return null;
  }

  return {
    appointmentId: new ObjectId(appointmentId),
    customerId: new ObjectId(customerId),
    transactionId: new ObjectId(transactionId),
  };
}

async function handleUnsuccessfulSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const metadata = readSessionMetadata(session);

  if (metadata === null) {
    return;
  }

  const { transactions } = await getDatabaseCollections();

  await transactions.updateOne(
    {
      _id: metadata.transactionId,
      appointmentId: metadata.appointmentId,
      customerId: metadata.customerId,
      status: "pending",
      $or: [
        {
          stripeSessionId: null,
        },
        {
          stripeSessionId: session.id,
        },
      ],
    },
    {
      $set: {
        status: "failed",
        stripeSessionId: session.id,
      },
    },
  );
}

async function handleSuccessfulSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const metadata = readSessionMetadata(session);

  if (
    metadata === null ||
    session.mode !== "payment" ||
    session.payment_status !== "paid" ||
    session.amount_total === null ||
    session.currency === null
  ) {
    return;
  }

  const sessionCurrency = session.currency;
  const { currency } = getStripeConfiguration();

  await withDatabaseTransaction(async (dbSession) => {
    const { appointments, transactions } =
      await getDatabaseCollections();

    const transaction = await transactions.findOne(
      {
        _id: metadata.transactionId,
        appointmentId: metadata.appointmentId,
        customerId: metadata.customerId,
        $or: [
          {
            stripeSessionId: null,
          },
          {
            stripeSessionId: session.id,
          },
        ],
      },
      {
        session: dbSession,
      },
    );

    if (transaction === null) {
      return;
    }

    const appointment = await appointments.findOne(
      {
        _id: metadata.appointmentId,
        customerId: metadata.customerId,
      },
      {
        session: dbSession,
        projection: appointmentProjection,
      },
    );

    if (appointment === null) {
      throw new HttpError(
        400,
        "Invalid Webhook",
        "Payment metadata did not match the appointment.",
      );
    }

    const expectedAmount = toMinorCurrencyUnit(
      appointment.servicePrice,
      currency,
    );

    if (
      transaction.amount !== appointment.servicePrice ||
      transaction.currency !== currency ||
      sessionCurrency.toLowerCase() !== currency ||
      session.amount_total !== expectedAmount
    ) {
      throw new HttpError(
        400,
        "Invalid Webhook",
        "Payment details did not match the expected amount.",
      );
    }

    if (
      transaction.status === "completed" &&
      appointment.paymentStatus === "paid"
    ) {
      return;
    }

    if (
      transaction.status !== "pending" &&
      transaction.status !== "completed"
    ) {
      return;
    }

    if (appointment.paymentStatus !== "paid") {
      if (appointment.status !== "confirmed") {
        await transactions.updateOne(
          {
            _id: transaction._id,
            status: "pending",
          },
          {
            $set: {
              status: "failed",
              stripeSessionId: session.id,
            },
          },
          {
            session: dbSession,
          },
        );

        return;
      }

      const appointmentUpdate = await appointments.updateOne(
        {
          _id: appointment._id,
          customerId: metadata.customerId,
          status: "confirmed",
          paymentStatus: "unpaid",
        },
        {
          $set: {
            paymentStatus: "paid",
            updatedAt: new Date(),
          },
        },
        {
          session: dbSession,
        },
      );

      if (appointmentUpdate.matchedCount !== 1) {
        throw new HttpError(
          409,
          "Conflict",
          "Appointment payment state changed during confirmation.",
        );
      }
    }

    const transactionUpdate = await transactions.updateOne(
      {
        _id: transaction._id,
        status: {
          $in: ["pending", "completed"],
        },
        $or: [
          {
            stripeSessionId: null,
          },
          {
            stripeSessionId: session.id,
          },
        ],
      },
      {
        $set: {
          status: "completed",
          stripeSessionId: session.id,
        },
      },
      {
        session: dbSession,
      },
    );

    if (transactionUpdate.matchedCount !== 1) {
      throw new HttpError(
        409,
        "Conflict",
        "Payment transaction state changed during confirmation.",
      );
    }
  });
}

export async function processStripeWebhook(
  rawBody: Buffer,
  signature: string | undefined,
): Promise<void> {
  if (
    signature === undefined ||
    signature.trim() === ""
  ) {
    throw new HttpError(
      400,
      "Invalid Webhook",
      "A Stripe signature is required.",
    );
  }

  const { stripe, webhookSecret } =
    getStripeConfiguration();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch {
    throw new HttpError(
      400,
      "Invalid Webhook",
      "Stripe webhook signature verification failed.",
    );
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleSuccessfulSession(event.data.object);
      return;

    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      await handleUnsuccessfulSession(event.data.object);
      return;

    default:
      return;
  }
}

async function toAdminTransactionViews(
  transactions: TransactionWithId[],
): Promise<TransactionView[]> {
  const results = transactions.map(toTransactionView);

  if (transactions.length === 0) {
    return results;
  }

  const { appointments, users } =
    await getDatabaseCollections();

  const appointmentIds = [
    ...new Set(
      transactions.map((transaction) =>
        transaction.appointmentId.toHexString(),
      ),
    ),
  ].map((id) => new ObjectId(id));

  const customerIds = [
    ...new Set(
      transactions.map((transaction) =>
        transaction.customerId.toHexString(),
      ),
    ),
  ].map((id) => new ObjectId(id));

  const [appointmentDocuments, userDocuments] =
    await Promise.all([
      appointments.find(
        {
          _id: {
            $in: appointmentIds,
          },
        },
        {
          projection: {
            _id: 1,
            appointmentDate: 1,
            timeSlot: 1,
            status: 1,
          },
        },
      ).toArray(),

      users.find(
        {
          _id: {
            $in: customerIds,
          },
        },
        {
          projection: {
            _id: 1,
            name: 1,
            email: 1,
          },
        },
      ).toArray(),
    ]);

  const appointmentMap = new Map(
    appointmentDocuments.map((appointment) => [
      appointment._id.toHexString(),
      {
        id: appointment._id.toHexString(),
        appointmentDate: appointment.appointmentDate,
        timeSlot: appointment.timeSlot,
        status: appointment.status,
      },
    ]),
  );

  const customerMap = new Map(
    userDocuments.map(
      (customer: WithId<UserDocument>) => [
        customer._id.toHexString(),
        {
          id: customer._id.toHexString(),
          name: customer.name,
          email: customer.email,
        },
      ],
    ),
  );

  return results.map((result, index) => {
    const transaction = transactions[index];

    if (transaction === undefined) {
      return result;
    }

    result.customer =
      customerMap.get(
        transaction.customerId.toHexString(),
      ) ?? null;

    result.appointment =
      appointmentMap.get(
        transaction.appointmentId.toHexString(),
      ) ?? null;

    return result;
  });
}

async function listTransactions(
  query: TransactionListQuery,
  customerId?: ObjectId,
): Promise<TransactionListResult> {
  const { transactions } = await getDatabaseCollections();

  const filter: Filter<TransactionDocument> = {};

  if (customerId !== undefined) {
    filter.customerId = customerId;
  }

  if (query.status !== undefined) {
    filter.status = query.status;
  }

  if (
    query.dateFrom !== undefined ||
    query.dateTo !== undefined
  ) {
    filter.createdAt = {
      ...(query.dateFrom === undefined
        ? {}
        : {
            $gte: query.dateFrom,
          }),

      ...(query.dateTo === undefined
        ? {}
        : {
            $lte: new Date(
              query.dateTo.getTime() +
                24 * 60 * 60 * 1000 -
                1,
            ),
          }),
    };
  }

  const skip = (query.page - 1) * query.limit;

  const [documents, total] = await Promise.all([
    transactions
      .find(filter, {
        projection: transactionSafeProjection,
      })
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .skip(skip)
      .limit(query.limit)
      .toArray(),

    transactions.countDocuments(filter),
  ]);

  return {
    transactions:
      customerId === undefined
        ? await toAdminTransactionViews(documents)
        : documents.map(toTransactionView),

    pagination: getPagination(
      query.page,
      query.limit,
      total,
    ),
  };
}

export function listCustomerTransactions(
  customerId: string,
  query: Pick<TransactionListQuery, "page" | "limit">,
): Promise<TransactionListResult> {
  if (!ObjectId.isValid(customerId)) {
    throw new HttpError(
      400,
      "Bad Request",
      "Invalid customer ID.",
    );
  }

  return listTransactions(
    query,
    new ObjectId(customerId),
  );
}

export function listAdminTransactions(
  query: TransactionListQuery,
): Promise<TransactionListResult> {
  return listTransactions(query);
}
