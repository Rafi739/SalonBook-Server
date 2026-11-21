import {
  cancelAppointment,
  createAppointment,
  getAppointmentById,
  listAppointments,
  listMyAppointments,
  updateAppointmentStatus,
} from "../services/appointment.service.js";
import { getRequestUser } from "../utils/request-auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { parseMongoObjectId } from "../utils/mongo-id.js";
import {
  parseAdminAppointmentQuery,
  parseAppointmentHistoryQuery,
  validateAppointmentStatus,
  validateCreateAppointment,
} from "../validators/appointment.validators.js";

export const createAppointmentController = asyncHandler(async (request, response) => {
  const customer = getRequestUser(request);
  const input = validateCreateAppointment(request.body);
  const appointment = await createAppointment(customer, input);
  response.status(201).json({ appointment });
});

export const listMyAppointmentsController = asyncHandler(async (request, response) => {
  const customer = getRequestUser(request);
  const query = parseAppointmentHistoryQuery(request.query);
  const result = await listMyAppointments(customer.id, query);
  response.status(200).json(result);
});

export const getAppointmentController = asyncHandler(async (request, response) => {
  const requester = getRequestUser(request);
  const appointmentId = parseMongoObjectId(request.params.id, "appointment");
  const appointment = await getAppointmentById(appointmentId, requester);
  response.status(200).json({ appointment });
});

export const cancelAppointmentController = asyncHandler(async (request, response) => {
  const requester = getRequestUser(request);
  const appointmentId = parseMongoObjectId(request.params.id, "appointment");
  const appointment = await cancelAppointment(appointmentId, requester);
  response.status(200).json({ appointment });
});

export const listAppointmentsController = asyncHandler(async (request, response) => {
  const query = parseAdminAppointmentQuery(request.query);
  const result = await listAppointments(query);
  response.status(200).json(result);
});


export const updateAppointmentStatusController = asyncHandler(async (request, response) => {
  const admin = getRequestUser(request);
  const appointmentId = parseMongoObjectId(request.params.id, "appointment");
  const status = validateAppointmentStatus(request.body);

  const appointment = await updateAppointmentStatus(appointmentId, status, admin);

  response.status(200).json({ appointment });
});
