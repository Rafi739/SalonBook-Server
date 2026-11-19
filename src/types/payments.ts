import type { TransactionStatus } from "./database.js";

export interface TransactionView {
  id: string;
  appointmentId: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  createdAt: Date;
  customer?: {
    id: string;
    name: string;
    email: string;
  } | null;
  appointment?: {
    id: string;
    appointmentDate: Date;
    timeSlot: string;
    status: string;
  } | null;
}

export interface TransactionListResult {
  transactions: TransactionView[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
