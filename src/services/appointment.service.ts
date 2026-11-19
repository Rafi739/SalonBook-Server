import { MongoServerError, ObjectId, type Filter, type Sort, type WithId } from "mongodb";
import { getDatabaseCollections } from "../config/collections.js";
import type { AppointmentDocument, AppointmentStatus, ServiceDocument, UserDocument } from "../types/database.js";
import type {
  AppointmentCustomerSummary,
  AppointmentListResult,
  AppointmentServiceSummary,
  AppointmentView,
} from "../types/appointments.js";
import type { AuthenticatedUser } from "../types/auth.js";
import type {
  AdminAppointmentQuery,
  AppointmentHistoryQuery,
  CreateAppointmentInput,
} from "../validators/appointment.validators.js";
import { HttpError } from "../utils/http-error.js";

type AppointmentWithId = WithId<AppointmentDocument>;

const appointmentProjection = {
  _id: 1,
  serviceId: 1,
  customerId: 1,
  appointmentDate: 1,
  timeSlot: 1,
  message: 1,
  servicePrice: 1,
  paymentStatus: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

const serviceSummaryProjection = {
  _id: 1,
  serviceName: 1,
  category: 1,
  duration: 1,
  image: 1,
} as const;

const customerSummaryProjection = {
  _id: 1,
  name: 1,
  email: 1,
  image: 1,
} as const;

async function toAppointmentViews(
  appointments: AppointmentWithId[],
  includeCustomer: boolean,
): Promise<AppointmentView[]> {
  if (appointments.length === 0) {
    return [];
  }

  const { services, users } = await getDatabaseCollections();
  const serviceIds = [...new Map(
    appointments.map((appointment) => [
      appointment.serviceId.toHexString(),
      appointment.serviceId,
    ]),
  ).values()];
  const customerIds = includeCustomer
    ? [...new Map(
      appointments.map((appointment) => [
        appointment.customerId.toHexString(),
        appointment.customerId,
      ]),
    ).values()]
    : [];
  const [serviceDocuments, customerDocuments] = await Promise.all([
    services
      .find({ _id: { $in: serviceIds } }, { projection: serviceSummaryProjection })
      .toArray(),
    includeCustomer
      ? users
        .find({ _id: { $in: customerIds } }, { projection: customerSummaryProjection })
        .toArray()
      : Promise.resolve([] as WithId<UserDocument>[]),
  ]);
  const serviceSummaries = new Map<string, AppointmentServiceSummary>(
    serviceDocuments.map((service: WithId<ServiceDocument>) => [
      service._id.toHexString(),
      {
        id: service._id.toHexString(),
        serviceName: service.serviceName,
        category: service.category,
        duration: service.duration,
        image: service.image,
      },
    ]),
  );
  const customerSummaries = new Map<string, AppointmentCustomerSummary>(
    customerDocuments.map((customer) => [
      customer._id.toHexString(),
      {
        id: customer._id.toHexString(),
        name: customer.name,
        email: customer.email,
        image: customer.image,
      },
    ]),
  );

  return appointments.map((appointment) => {
    const view: AppointmentView = {
      id: appointment._id.toHexString(),
      serviceId: appointment.serviceId.toHexString(),
      customerId: appointment.customerId.toHexString(),
      appointmentDate: appointment.appointmentDate,
      timeSlot: appointment.timeSlot,
      message: appointment.message,
      servicePrice: appointment.servicePrice,
      paymentStatus: appointment.paymentStatus,
      status: appointment.status,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
      service: serviceSummaries.get(appointment.serviceId.toHexString()) ?? null,
    };
    if (includeCustomer) {
      view.customer = customerSummaries.get(appointment.customerId.toHexString()) ?? null;
    }
    return view;
  });
}

function getPagination(page: number, limit: number, total: number): AppointmentListResult["pagination"] {
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

export async function createAppointment(
  customer: AuthenticatedUser,
  input: CreateAppointmentInput,
): Promise<AppointmentView> {
  if (customer.role !== "customer") {
    throw new HttpError(403, "Forbidden", "Only customers can create appointments.");
  }

  const { services, appointments } = await getDatabaseCollections();
  const service = await services.findOne(
    { _id: input.serviceId, status: "active" },
    { projection: { _id: 1, price: 1 } },
  );
  if (service === null) {
    throw new HttpError(404, "Not Found", "Active service not found.");
  }

  const customerId = new ObjectId(customer.id);
  const duplicate = await appointments.findOne({
    customerId,
    appointmentDate: input.appointmentDate,
    timeSlot: input.timeSlot,
    status: { $in: ["pending", "confirmed"] },
  });
  if (duplicate !== null) {
    throw new HttpError(409, "Conflict", "An active appointment already exists for this date and time.");
  }

  const now = new Date();
  const document: AppointmentDocument = {
    serviceId: input.serviceId,
    customerId,
    appointmentDate: input.appointmentDate,
    timeSlot: input.timeSlot,
    message: input.message ?? "",
    servicePrice: service.price,
    paymentStatus: "unpaid",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  let appointmentId: ObjectId;
  try {
    const result = await appointments.insertOne(document);
    appointmentId = result.insertedId;
  } catch (error: unknown) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new HttpError(409, "Conflict", "An active appointment already exists for this date and time.");
    }
    throw error;
  }
  return getAppointmentById(appointmentId, customer);
}

export async function listMyAppointments(
  customerId: string,
  query: AppointmentHistoryQuery,
): Promise<AppointmentListResult> {
  const { appointments } = await getDatabaseCollections();
  const filter: Filter<AppointmentDocument> = { customerId: new ObjectId(customerId) };
  if (query.status !== undefined) {
    filter.status = query.status;
  }

  const skip = (query.page - 1) * query.limit;
  const [documents, total] = await Promise.all([
    appointments
      .find(filter, { projection: appointmentProjection })
      .sort({ appointmentDate: -1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit)
      .toArray(),
    appointments.countDocuments(filter),
  ]);
  return {
    appointments: await toAppointmentViews(documents, false),
    pagination: getPagination(query.page, query.limit, total),
  };
}

export async function getAppointmentById(
  appointmentId: ObjectId,
  requester: AuthenticatedUser,
): Promise<AppointmentView> {
  const { appointments } = await getDatabaseCollections();
  const appointment = await appointments.findOne(
    { _id: appointmentId },
    { projection: appointmentProjection },
  );
  if (appointment === null) {
    throw new HttpError(404, "Not Found", "Appointment not found.");
  }

  if (
    requester.role === "customer" &&
    !appointment.customerId.equals(new ObjectId(requester.id))
  ) {
    throw new HttpError(404, "Not Found", "Appointment not found.");
  }

  const [view] = await toAppointmentViews([appointment], requester.role === "admin");
  if (view === undefined) {
    throw new HttpError(404, "Not Found", "Appointment not found.");
  }
  return view;
}

export async function cancelAppointment(
  appointmentId: ObjectId,
  requester: AuthenticatedUser,
): Promise<AppointmentView> {
  const { appointments } = await getDatabaseCollections();
  const filter: Filter<AppointmentDocument> = {
    _id: appointmentId,
    status: requester.role === "admin"
      ? { $in: ["pending", "confirmed"] }
      : "pending",
  };
  if (requester.role === "customer") {
    filter.customerId = new ObjectId(requester.id);
  }

  const result = await appointments.updateOne(
    filter,
    { $set: { status: "cancelled", updatedAt: new Date() } },
  );
  if (result.matchedCount === 0) {
    const existing = await appointments.findOne(
      { _id: appointmentId },
      { projection: { customerId: 1, status: 1 } },
    );
    if (existing === null) {
      throw new HttpError(404, "Not Found", "Appointment not found.");
    }
    if (
      requester.role === "customer" &&
      !existing.customerId.equals(new ObjectId(requester.id))
    ) {
      throw new HttpError(404, "Not Found", "Appointment not found.");
    }
    throw new HttpError(409, "Conflict", "The appointment's current status does not permit cancellation.");
  }
  return getAppointmentById(appointmentId, requester);
}

export async function listAppointments(query: AdminAppointmentQuery): Promise<AppointmentListResult> {
  const { appointments } = await getDatabaseCollections();
  const filter: Filter<AppointmentDocument> = {};
  if (query.status !== undefined) {
    filter.status = query.status;
  }
  if (query.paymentStatus !== undefined) {
    filter.paymentStatus = query.paymentStatus;
  }
  if (query.dateFrom !== undefined || query.dateTo !== undefined) {
    filter.appointmentDate = {
      ...(query.dateFrom === undefined ? {} : { $gte: query.dateFrom }),
      ...(query.dateTo === undefined ? {} : { $lte: query.dateTo }),
    };
  }

  const direction: 1 | -1 = query.sortOrder === "asc" ? 1 : -1;
  const sort: Sort = { [query.sortBy]: direction, _id: direction };
  const skip = (query.page - 1) * query.limit;
  const [documents, total] = await Promise.all([
    appointments
      .find(filter, { projection: appointmentProjection })
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .toArray(),
    appointments.countDocuments(filter),
  ]);
  return {
    appointments: await toAppointmentViews(documents, true),
    pagination: getPagination(query.page, query.limit, total),
  };
}

export function permittedPreviousStatuses(status: AppointmentStatus): AppointmentStatus[] {
  switch (status) {
    case "confirmed":
    case "rejected":
      return ["pending"];
    case "cancelled":
      return ["pending", "confirmed"];
    case "completed":
      return ["confirmed"];
    case "pending":
      return [];
  }
}

export async function updateAppointmentStatus(
  appointmentId: ObjectId,
  status: AppointmentStatus,
  admin: AuthenticatedUser,
): Promise<AppointmentView> {
  if (admin.role !== "admin") {
    throw new HttpError(403, "Forbidden", "Only admins can change appointment status.");
  }

  const { appointments } = await getDatabaseCollections();
  const result = await appointments.updateOne(
    { _id: appointmentId, status: { $in: permittedPreviousStatuses(status) } },
    { $set: { status, updatedAt: new Date() } },
  );
  if (result.matchedCount === 0) {
    const appointment = await appointments.findOne(
      { _id: appointmentId },
      { projection: { _id: 1 } },
    );
    if (appointment === null) {
      throw new HttpError(404, "Not Found", "Appointment not found.");
    }
    throw new HttpError(409, "Conflict", "The appointment status transition is not allowed.");
  }
  return getAppointmentById(appointmentId, admin);
}
