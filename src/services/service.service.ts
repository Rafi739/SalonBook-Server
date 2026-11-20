
import { ObjectId, type Filter, type Sort, type WithId } from "mongodb";
import { getDatabaseCollections } from "../config/collections.js";
import { withDatabaseTransaction } from "../config/database.js";
import type { ServiceDocument } from "../types/database.js";
import type { ServiceListResult, ServiceView } from "../types/services.js";
import type {
  CreateServiceInput,
  PublicServiceListQuery,
  AdminServiceListQuery,
  UpdateServiceInput,
} from "../validators/service.validators.js";
import { HttpError } from "../utils/http-error.js";

type ServiceWithId = WithId<ServiceDocument>;

const serviceProjection = {
  _id: 1,
  serviceName: 1,
  category: 1,
  description: 1,
  price: 1,
  duration: 1,
  image: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toServiceView(service: ServiceWithId): ServiceView {
  return {
    id: service._id.toHexString(),
    serviceName: service.serviceName,
    category: service.category,
    description: service.description,
    price: service.price,
    duration: service.duration,
    image: service.image,
    status: service.status,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}

// Public: Only active services are visible.
export async function listPublicServices(
  query: PublicServiceListQuery,
): Promise<ServiceListResult> {
  const { services } = await getDatabaseCollections();
  const filter: Filter<ServiceDocument> = { status: "active" };

  if (query.search !== undefined) {
    const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.serviceName = new RegExp(escapedSearch, "i");
  }

  if (query.category !== undefined) {
    filter.category = query.category;
  }

  const direction: 1 | -1 = query.sort === "price_asc" ? 1 : -1;
  const sort: Sort = { price: direction, _id: direction };
  const skip = (query.page - 1) * query.limit;

  const [documents, total] = await Promise.all([
    services
      .find(filter, { projection: serviceProjection })
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .toArray(),
    services.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / query.limit);

  return {
    services: documents.map(toServiceView),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1 && totalPages > 0,
    },
  };
}

// Admin: Can view both active and inactive services.
export async function listAdminServices(
  query: AdminServiceListQuery,
): Promise<ServiceListResult> {
  const { services } = await getDatabaseCollections();
  const filter: Filter<ServiceDocument> = {};

  if (query.status !== undefined) {
    filter.status = query.status;
  }

  if (query.search !== undefined) {
    const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.serviceName = new RegExp(escapedSearch, "i");
  }

  if (query.category !== undefined) {
    filter.category = query.category;
  }

  const direction: 1 | -1 = query.sort === "price_asc" ? 1 : -1;
  const sort: Sort = { price: direction, _id: direction };
  const skip = (query.page - 1) * query.limit;

  const [documents, total] = await Promise.all([
    services
      .find(filter, { projection: serviceProjection })
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .toArray(),
    services.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / query.limit);

  return {
    services: documents.map(toServiceView),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasNextPage: query.page < totalPages,
      hasPreviousPage: query.page > 1 && totalPages > 0,
    },
  };
}

export async function getPublicServiceById(
  serviceId: ObjectId,
): Promise<ServiceView> {
  const { services } = await getDatabaseCollections();

  const service = await services.findOne(
    { _id: serviceId, status: "active" },
    { projection: serviceProjection },
  );

  if (service === null) {
    throw new HttpError(404, "Not Found", "Service not found.");
  }

  return toServiceView(service);
}

export async function createService(
  input: CreateServiceInput,
): Promise<ServiceView> {
  const { services } = await getDatabaseCollections();
  const now = new Date();

  const document: ServiceDocument = {
    ...input,
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now,
  };

  const result = await services.insertOne(document);

  return toServiceView({ _id: result.insertedId, ...document });
}

export async function updateService(
  serviceId: ObjectId,
  update: UpdateServiceInput,
): Promise<ServiceView> {
  const { services } = await getDatabaseCollections();

  const result = await services.updateOne(
    { _id: serviceId },
    { $set: { ...update, updatedAt: new Date() } },
  );

  if (result.matchedCount === 0) {
    throw new HttpError(404, "Not Found", "Service not found.");
  }

  return getServiceById(serviceId);
}

export async function getServiceById(
  serviceId: ObjectId,
): Promise<ServiceView> {
  const { services } = await getDatabaseCollections();

  const service = await services.findOne(
    { _id: serviceId },
    { projection: serviceProjection },
  );

  if (service === null) {
    throw new HttpError(404, "Not Found", "Service not found.");
  }

  return toServiceView(service);
}

export async function deleteService(serviceId: ObjectId): Promise<void> {
  const { services, appointments } = await getDatabaseCollections();

  await withDatabaseTransaction(async (session) => {
    const service = await services.findOne(
      { _id: serviceId },
      { session, projection: { _id: 1 } },
    );

    if (service === null) {
      throw new HttpError(404, "Not Found", "Service not found.");
    }

    const appointment = await appointments.findOne(
      { serviceId },
      { session, projection: { _id: 1 } },
    );

    if (appointment !== null) {
      throw new HttpError(
        409,
        "Conflict",
        "Service cannot be deleted because appointments reference it.",
      );
    }

    const result = await services.deleteOne({ _id: serviceId }, { session });

    if (result.deletedCount !== 1) {
      throw new HttpError(404, "Not Found", "Service not found.");
    }
  });
}
