import type { UserRole } from "./database.js";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  image: string;
  role: UserRole;
}
