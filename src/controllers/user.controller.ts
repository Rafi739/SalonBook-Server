import { getMyProfile, getUserById, listUsers, setCustomerBlockedState, updateMyProfile } from "../services/user.service.js";
import { getRequestUser } from "../utils/request-auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { parseUserListQuery, parseUserObjectId, validateProfileUpdate } from "../validators/user.validators.js";

export const getMyProfileController = asyncHandler(async (request, response) => {
  const user = getRequestUser(request);
  const profile = await getMyProfile(user.id);
  response.status(200).json({ user: profile });
});

export const updateMyProfileController = asyncHandler(async (request, response) => {
  const user = getRequestUser(request);
  const update = validateProfileUpdate(request.body);
  const profile = await updateMyProfile(user.id, update);
  response.status(200).json({ user: profile });
});

export const listUsersController = asyncHandler(async (request, response) => {
  const query = parseUserListQuery(request.query);
  const result = await listUsers(query);
  response.status(200).json(result);
});

export const getUserByIdController = asyncHandler(async (request, response) => {
  const userId = parseUserObjectId(request.params.id);
  const user = await getUserById(userId);
  response.status(200).json({ user });
});

export const blockCustomerController = asyncHandler(async (request, response) => {
  const admin = getRequestUser(request);
  const userId = parseUserObjectId(request.params.id);
  const user = await setCustomerBlockedState(userId, admin.id, true);
  response.status(200).json({ user });
});

export const unblockCustomerController = asyncHandler(async (request, response) => {
  const admin = getRequestUser(request);
  const userId = parseUserObjectId(request.params.id);
  const user = await setCustomerBlockedState(userId, admin.id, false);
  response.status(200).json({ user });
});
