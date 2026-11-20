
export interface RevenueByCurrency {
  currency: string;
  amount: number;
  transactions: number;
}

export interface AdminDashboardOverview {
  totalCustomers: number;
  totalServices: number;
  activeServices: number;
  inactiveServices: number;
  totalAppointments: number;
  pendingAppointments: number;
  confirmedAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  rejectedAppointments: number;
  revenueByCurrency: RevenueByCurrency[];
}
