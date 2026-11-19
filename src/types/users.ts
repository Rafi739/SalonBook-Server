import type { UserRole } from "./database.js";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string;
  role: UserRole;
  createdAt: Date;
}

export interface AdminUserProfile extends UserProfile {
  isBlocked: boolean;
}

export interface UserPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface UserListResult {
  users: AdminUserProfile[];
  pagination: UserPagination;
}
