import {
  createService,
  deleteService,
  getPublicServiceById,
  listPublicServices,
  updateService,
} from "../services/service.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { parseMongoObjectId } from "../utils/mongo-id.js";
import {
  parsePublicServiceListQuery,
  validateCreateService,
  validateServiceStatus,
  validateServiceUpdate,
} from "../validators/service.validators.js";

export const listPublicServicesController = asyncHandler(async (request, response) => {
  const query = parsePublicServiceListQuery(request.query);
  const result = await listPublicServices(query);
  response.status(200).json(result);
});

export const getPublicServiceController = asyncHandler(async (request, response) => {
  const serviceId = parseMongoObjectId(request.params.id, "service");
  const service = await getPublicServiceById(serviceId);
  response.status(200).json({ service });
});

export const createServiceController = asyncHandler(async (request, response) => {
  const input = validateCreateService(request.body);
  const service = await createService(input);
  response.status(201).json({ service });
});

export const updateServiceController = asyncHandler(async (request, response) => {
  const serviceId = parseMongoObjectId(request.params.id, "service");
  const update = validateServiceUpdate(request.body);
  const service = await updateService(serviceId, update);
  response.status(200).json({ service });
});

export const updateServiceStatusController = asyncHandler(async (request, response) => {
  const serviceId = parseMongoObjectId(request.params.id, "service");
  const update = validateServiceStatus(request.body);
  const service = await updateService(serviceId, update);
  response.status(200).json({ service });
});

export const deleteServiceController = asyncHandler(async (request, response) => {
  const serviceId = parseMongoObjectId(request.params.id, "service");
  await deleteService(serviceId);
  response.status(204).end();
});
