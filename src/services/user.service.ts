import { ObjectId, type Filter, type Sort, type WithId } from "mongodb";
import { getDatabaseCollections } from "../config/collections.js";
import type { UserDocument } from "../types/database.js";
import type { AdminUserProfile, UserListResult, UserProfile } from "../types/users.js";
import type { ProfileUpdate, UserListQuery } from "../validators/user.validators.js";
import { HttpError } from "../utils/http-error.js";

type UserProfileDocument = WithId<UserDocument>;

const profileProjection = {
  _id: 1,
  name: 1,
  email: 1,
  image: 1,
  role: 1,
  createdAt: 1,
} as const;

const adminProfileProjection = {
  ...profileProjection,
  isBlocked: 1,
} as const;

function toUserProfile(user: UserProfileDocument): UserProfile {
  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function toAdminUserProfile(user: UserProfileDocument): AdminUserProfile {
  return {
    ...toUserProfile(user),
    isBlocked: user.isBlocked,
  };
}

async function findUserProfile(userId: ObjectId): Promise<UserProfileDocument> {
  const { users } = await getDatabaseCollections();
  const user = await users.findOne({ _id: userId }, { projection: profileProjection });
  if (user === null) {
    throw new HttpError(404, "Not Found", "User not found.");
  }
  return user;
}

async function findAdminUserProfile(userId: ObjectId): Promise<UserProfileDocument> {
  const { users } = await getDatabaseCollections();
  const user = await users.findOne({ _id: userId }, { projection: adminProfileProjection });
  if (user === null) {
    throw new HttpError(404, "Not Found", "User not found.");
  }
  return user;
}

export async function getMyProfile(userId: string): Promise<UserProfile> {
  return toUserProfile(await findUserProfile(new ObjectId(userId)));
}

export async function updateMyProfile(
  userId: string,
  update: ProfileUpdate,
): Promise<UserProfile> {
  const { users } = await getDatabaseCollections();
  const result = await users.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { ...update, updatedAt: new Date() } },
  );
  if (result.matchedCount === 0) {
    throw new HttpError(404, "Not Found", "User not found.");
  }

  return toUserProfile(await findUserProfile(new ObjectId(userId)));
}

export async function listUsers(query: UserListQuery): Promise<UserListResult> {
  const { users } = await getDatabaseCollections();
  const filter: Filter<UserDocument> = {};

  if (query.search !== undefined) {
    const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchPattern = new RegExp(escapedSearch, "i");
    filter.$or = [{ name: searchPattern }, { email: searchPattern }];
  }
  if (query.role !== undefined) {
    filter.role = query.role;
  }
  if (query.blocked !== undefined) {
    filter.isBlocked = query.blocked;
  }

  const direction: 1 | -1 = query.sortOrder === "asc" ? 1 : -1;
  const sort: Sort = { [query.sortBy]: direction };
  const skip = (query.page - 1) * query.limit;
  const [documents, total] = await Promise.all([
    users
      .find(filter, { projection: adminProfileProjection })
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .toArray(),
    users.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / query.limit);

  return {
    users: documents.map(toAdminUserProfile),
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

export async function getUserById(userId: ObjectId): Promise<AdminUserProfile> {
  return toAdminUserProfile(await findAdminUserProfile(userId));
}

export async function setCustomerBlockedState(
  targetUserId: ObjectId,
  adminUserId: string,
  blocked: boolean,
): Promise<AdminUserProfile> {
  if (blocked && targetUserId.toHexString() === adminUserId) {
    throw new HttpError(403, "Forbidden", "You cannot block your own account.");
  }

  const { users } = await getDatabaseCollections();
  const target = await users.findOne(
    { _id: targetUserId },
    { projection: { role: 1, isBlocked: 1 } },
  );
  if (target === null) {
    throw new HttpError(404, "Not Found", "User not found.");
  }
  if (target.role !== "customer") {
    throw new HttpError(403, "Forbidden", "Only customer accounts can be blocked or unblocked.");
  }
  if (target.isBlocked === blocked) {
    throw new HttpError(
      409,
      "Conflict",
      blocked ? "The customer account is already blocked." : "The customer account is not blocked.",
    );
  }

  const result = await users.updateOne(
    { _id: targetUserId, role: "customer", isBlocked: !blocked },
    { $set: { isBlocked: blocked, updatedAt: new Date() } },
  );
  if (result.matchedCount === 0) {
    const latestTarget = await users.findOne(
      { _id: targetUserId },
      { projection: { role: 1, isBlocked: 1 } },
    );
    if (latestTarget === null) {
      throw new HttpError(404, "Not Found", "User not found.");
    }
    if (latestTarget.role !== "customer") {
      throw new HttpError(403, "Forbidden", "Only customer accounts can be blocked or unblocked.");
    }
    if (latestTarget.isBlocked !== blocked) {
      throw new HttpError(409, "Conflict", "The customer account state changed; retry the operation.");
    }
  }

  return toAdminUserProfile(await findAdminUserProfile(targetUserId));
}
