import type { AppointmentStatus, PaymentStatus, ServiceCategory } from "./database.js";

export interface AppointmentServiceSummary {
  id: string;
  serviceName: string;
  category: ServiceCategory;
  duration: number;
  image: string;
}

export interface AppointmentCustomerSummary {
  id: string;
  name: string;
  email: string;
  image: string;
}

export interface AppointmentView {
  id: string;
  serviceId: string;
  customerId: string;
  appointmentDate: Date;
  timeSlot: string;
  message: string;
  servicePrice: number;
  paymentStatus: PaymentStatus;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
  service: AppointmentServiceSummary | null;
  customer?: AppointmentCustomerSummary | null;
}

export interface AppointmentListResult {
  appointments: AppointmentView[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
