import type { ObjectId } from "mongodb";

export type UserRole = "customer" | "admin";
export type ServiceCategory = "Men's" | "Women's" | "Unisex";
export type ServiceStatus = "active" | "inactive";
export type PaymentStatus = "unpaid" | "paid";
export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "rejected" | "completed";
export type TransactionStatus = "pending" | "completed" | "failed" | "refunded";

export interface UserDocument {
  name: string;
  email: string;
  image: string;
  role: UserRole;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceDocument {
  serviceName: string;
  category: ServiceCategory;
  description: string;
  price: number;
  duration: number;
  image: string;
  status: ServiceStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentDocument {
  serviceId: ObjectId;
  customerId: ObjectId;
  appointmentDate: Date;
  timeSlot: string;
  message: string;
  servicePrice: number;
  paymentStatus: PaymentStatus;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionDocument {
  appointmentId: ObjectId;
  customerId: ObjectId;
  amount: number;
  currency: string;
  stripeSessionId: string | null;
  status: TransactionStatus;
  createdAt: Date;
}
