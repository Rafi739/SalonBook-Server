import type { UserRole } from "../types/database.js";
import type { AuthenticatedUser } from "../types/auth.js";
import { getDatabaseCollections } from "../config/collections.js";
import { verifyAccessToken } from "../config/jwt.js";
import { HttpError } from "../utils/http-error.js";

function isUserRole(role: string): role is UserRole {
  return role === "customer" || role === "admin";
}

export async function getAuthenticatedUser(token: string): Promise<AuthenticatedUser> {
  const payload = await verifyAccessToken(token);
  const emailClaim = payload.email;
  const emailIsVerified = payload.email_verified === true || payload.emailVerified === true;
  if (typeof emailClaim !== "string" || emailClaim.trim() === "" || !emailIsVerified) {
    throw new HttpError(401, "Unauthorized", "The access token has no valid user identity.");
  }

  const email = emailClaim.trim().toLowerCase();
  const { users } = await getDatabaseCollections();
  const user = await users.findOne(
    { email },
    {
      projection: {
        _id: 1,
        name: 1,
        email: 1,
        image: 1,
        role: 1,
        isBlocked: 1,
      },
    },
  );

  if (user === null) {
    throw new HttpError(404, "Not Found", "The application user profile was not found.");
  }
  if (user.isBlocked !== false) {
    throw new HttpError(403, "Forbidden", "This account is blocked.");
  }
  if (!isUserRole(user.role)) {
    throw new HttpError(403, "Forbidden", "This account does not have a valid role.");
  }

  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
  };
}
